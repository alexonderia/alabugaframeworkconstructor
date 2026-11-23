import type { AFDocument } from '@alabuga/framework';
import { exportHTML, download, projectFilename } from './export';
import { preflightDocument } from './quality';

export type ExportArtifact = { filename: string; body: string; mediaType: string };
export type DocumentExporter = (doc: AFDocument) => Promise<ExportArtifact>;

export const htmlExporter: DocumentExporter = async (doc) => {
  const issues = (await preflightDocument(doc)).filter((issue) => issue.blocking);
  if (issues.length)
    throw new Error(
      'Содержимое не помещается или материал недоступен: ' +
        issues
          .map(
            (i) =>
              `${doc.kind === 'page' ? 'Секция' : 'Слайд'} ${i.section + 1} · ${i.screens?.join(', ')}: ${i.message}`,
          )
          .join('; '),
    );
  return {
    filename: projectFilename(doc.title, 'html'),
    body: await exportHTML(doc),
    mediaType: 'text/html',
  };
};

export async function downloadEditorHTML(doc: AFDocument) {
  const { filename, body, mediaType } = await htmlExporter(doc);
  download(filename, body, mediaType);
}
