import { expect, type Page } from '@playwright/test';

/** Use the same file menu and creation chooser as an author. */
export async function chooseNewProject(page: Page, id: string) {
  const dialog = page.getByRole('dialog', { name: 'Создать проект', exact: true });
  if (!(await dialog.isVisible())) {
    const file = page.locator('.project-menu');
    if (!(await file.evaluate((node) => (node as HTMLDetailsElement).open)))
      await file.locator(':scope > summary').click();
    await file.getByRole('button', { name: 'Создать проект…', exact: true }).click();
  }
  await dialog.locator('#' + id).click();
  await expect(dialog).toBeHidden();
}
