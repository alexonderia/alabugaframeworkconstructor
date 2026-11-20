import { getProject, importProject, readSetting, saveProject, writeSetting } from './storage';

/** Explicit installation link; ordinary visits never create projects. */
export async function installRequestedProjects() {
  const url = new URL(location.href),
    collection = url.searchParams.get('projects');
  if (collection !== 'ai-showcase' && collection !== 'slide-fit-report') return;
  const response = await fetch('../projects/' + collection + '/manifest.json');
  if (!response.ok) throw new Error('Не удалось загрузить сохранённые проекты.');
  const manifest = (await response.json()) as { projects: { id: string; file: string }[] };
  for (const item of manifest.projects) {
    const marker = 'installed:' + item.id;
    if (await readSetting(marker)) continue;
    // A previous installation may have saved the project before recording its marker.
    let existing = false;
    try {
      await getProject(item.id);
      existing = true;
    } catch (e) {
      if (!(e instanceof Error) || e.message !== 'Проект не найден') throw e;
    }
    if (!existing && !(await readSetting('removed:' + item.id))) {
      const file = await fetch('../projects/' + collection + '/' + item.file);
      if (!file.ok) throw new Error('Не удалось загрузить ' + item.file);
      await saveProject(item.id, importProject(await file.json()));
    }
    await writeSetting(marker, true);
  }
  url.searchParams.delete('projects');
  history.replaceState(null, '', url);
}
