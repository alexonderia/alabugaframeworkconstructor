import { readSetting, writeSetting } from './settings';
import { normalizeAssets } from './assets';
import { listProjects, saveProject } from './projects';
import { checked } from '../document-validation';
export async function migrateLegacy() {
  const marker = await readSetting('legacy-migrated');
  if (marker) return;
  const raw = localStorage.getItem('alabuga.builder.document.v1');
  if (!raw) return;
  const input = checked(JSON.parse(raw)),
    id = 'legacy-import';
  const normalized = await normalizeAssets(input),
    projects = await listProjects();
  const existing = projects.find(
    (p) =>
      p.id === id || JSON.stringify(checked(p.document)) === JSON.stringify(normalized.document),
  );
  if (!existing) await saveProject(id, input);
  await writeSetting('legacy-migrated', existing?.id ?? id);
}
