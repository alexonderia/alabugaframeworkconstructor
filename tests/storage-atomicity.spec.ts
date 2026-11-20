import { test, expect } from '@playwright/test';

test('an asset library write rolls back its image when writing its description throws', async ({
  page,
}) => {
  await page.goto('/tests/blank.html');
  const result = await page.evaluate(async () => {
    const storage = await import('/apps/editor/src/storage.ts' as string);
    const original = IDBObjectStore.prototype.put;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const data = canvas.toDataURL();
    let failure = '';
    IDBObjectStore.prototype.put = function (value, ...rest) {
      if (this.name === 'settings' && String(value.id).startsWith('asset-description:'))
        throw new DOMException('Описание не записано', 'QuotaExceededError');
      return original.call(this, value, ...rest);
    };
    try {
      await storage.addAsset(data, 'Не должно сохраниться частично');
    } catch (error) {
      failure = (error as Error).message;
    } finally {
      IDBObjectStore.prototype.put = original;
    }
    return {
      failure,
      assets: (await storage.listAssets()).map((asset: { id: string }) => asset.id),
    };
  });
  expect(result.failure).toContain('Описание не записано');
  expect(result.assets).toEqual([]);
});

test('a failed project save leaves summaries, current project, draft ownership and prepared assets unchanged', async ({
  page,
}) => {
  await page.goto('/tests/blank.html');
  const result = await page.evaluate(async () => {
    const storage = await import('/apps/editor/src/storage.ts' as string),
      model = await import('/apps/editor/src/model.ts' as string);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const paint = (color: string) => {
      const context = canvas.getContext('2d')!;
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return canvas.toDataURL();
    };
    const original = model.emptyDocument();
    original.pages[0].widgets = [
      { ...model.createWidget('image', original, 0), src: paint('red') },
    ];
    const saved = await storage.saveProject('saved-a', original);
    await storage.saveProject('saved-b', model.emptyDocument());
    await storage.writeSetting('ai-draft', {
      id: 'original-draft',
      projectId: 'saved-b',
      sections: [],
    });
    const before = {
      project: await storage.getProject('saved-a'),
      summaries: await storage.listProjectSummaries(),
      assets: (await storage.listAssets()).map((asset: { id: string }) => asset.id),
    };
    const invalid = structuredClone(saved);
    invalid.title = 'Не должно примениться';
    invalid.pages[0].widgets.push({
      ...model.createWidget('image', invalid, 0),
      src: paint('blue'),
    });
    invalid.pages[0].widgets.push({
      ...model.createWidget('image', invalid, 0),
      src: 'asset:' + 'f'.repeat(64),
    });
    let failure = '';
    try {
      await storage.saveProject('saved-a', invalid, 'original-draft');
    } catch (error) {
      failure = (error as Error).message;
    }
    const cachedVersion = storage.projectVersion('saved-a');
    const after = {
      project: await storage.getProject('saved-a'),
      summaries: await storage.listProjectSummaries(),
      assets: (await storage.listAssets()).map((asset: { id: string }) => asset.id),
    };
    return {
      before,
      after,
      failure,
      cachedVersion,
      current: (await storage.currentProject()).id,
      draftOwner: (await storage.readSetting('ai-draft')).value.projectId,
    };
  });
  expect(result.failure).toContain('Не найден материал');
  expect(result.after).toEqual(result.before);
  expect(result.cachedVersion).toBe(1);
  expect(result.current).toBe('saved-b');
  expect(result.draftOwner).toBe('saved-b');
});

test('competing save and cleanup transactions never leave a dangling image or partial project', async ({
  page,
}) => {
  await page.goto('/tests/blank.html');
  const results = await page.evaluate(async () => {
    const storage = await import('/apps/editor/src/storage.ts' as string),
      model = await import('/apps/editor/src/model.ts' as string);
    const results = [];
    for (const first of ['save', 'cleanup'] as const) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d')!;
      context.fillStyle = first === 'save' ? 'red' : 'blue';
      context.fillRect(0, 0, 1, 1);
      const asset = await storage.addAsset(canvas.toDataURL(), 'Конкурентная запись');
      const doc = model.emptyDocument();
      doc.pages[0].widgets = [{ ...model.createWidget('image', doc, 0), src: 'asset:' + asset }];
      const id = 'race-' + first,
        original = IDBDatabase.prototype.transaction;
      let started!: () => void,
        scope: string[] = [],
        armed = true;
      const began = new Promise<void>((resolve) => (started = resolve));
      IDBDatabase.prototype.transaction = function (stores, mode, options) {
        const transaction = original.call(this, stores, mode, options);
        if (
          armed &&
          mode === 'readwrite' &&
          transaction.objectStoreNames.contains(first === 'save' ? 'summaries' : 'revisions')
        ) {
          armed = false;
          scope = Array.from(transaction.objectStoreNames);
          started();
        }
        return transaction;
      };
      let writes: PromiseSettledResult<unknown>[];
      try {
        let saving: Promise<unknown>, cleaning: Promise<unknown>;
        if (first === 'save') {
          saving = storage.saveProject(id, doc, undefined, { expectedVersion: 0 });
          await began;
          cleaning = storage.removeUnusedAssets([asset]);
        } else {
          cleaning = storage.removeUnusedAssets([asset]);
          await began;
          saving = storage.saveProject(id, doc, undefined, { expectedVersion: 0 });
        }
        writes = await Promise.allSettled([saving, cleaning]);
      } finally {
        IDBDatabase.prototype.transaction = original;
      }
      const project = (await storage.listProjects()).find(
        (project: { id: string }) => project.id === id,
      );
      results.push({
        first,
        scope,
        status: writes[0].status,
        removed: writes[1].status === 'fulfilled' ? writes[1].value : -1,
        hasAsset: (await storage.listAssets()).some((value: { id: string }) => value.id === asset),
        hasProject: !!project,
        hasSummary: (await storage.listProjectSummaries()).some(
          (value: { id: string }) => value.id === id,
        ),
        current: (await storage.currentProject())?.id,
        reference: project?.document.pages[0].widgets[0].src,
      });
    }
    return results;
  });
  expect(results[0]).toMatchObject({
    first: 'save',
    status: 'fulfilled',
    removed: 0,
    hasAsset: true,
    hasProject: true,
    hasSummary: true,
    current: 'race-save',
  });
  expect(results[0].scope).toEqual(
    expect.arrayContaining(['projects', 'summaries', 'assets', 'settings']),
  );
  expect(results[0].reference).toMatch(/^asset:/);
  expect(results[1]).toMatchObject({
    first: 'cleanup',
    status: 'rejected',
    removed: 1,
    hasAsset: false,
    hasProject: false,
    hasSummary: false,
    current: 'race-save',
  });
  expect(results[1].scope).toEqual(
    expect.arrayContaining(['projects', 'revisions', 'assets', 'settings']),
  );
});
