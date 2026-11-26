# Author guide

## Projects and samples

Choose Create website or Create presentation in the gallery. Start with a blank document, choose a corporate template, copy a sample, or open AI generation. The creation dialog shows a thumbnail when you pick a template. Each project gets its own copy of the structure.

Preview keeps the project's modification date. Search matches names. The card menu lets you rename, download or move a project to the trash. The trash supports restoration and permanent deletion.

In the editor, File beside the project name contains project creation, JSON import and project settings. Version history has a separate button beside Undo and Redo; create restore points inside the history panel. The Materials tab is on the left, with storage management inside it.

## Guided learning mode

Choose «Режим знакомства» (Guided learning mode) from the help menu at the bottom of the editor. Five tasks cover text, layout, images, element styling, and preview with HTML export. The guide opens and highlights the relevant control. Next unlocks after an actual change. Empty projects are guided to add the missing block. Skipping a task does not mark it complete.

The instruction floats above the editor beside the relevant field. The background is dimmed and interaction is limited to the current task. Guidance stays visible during scrolling and above material libraries, layout dialogs and select menus. Exit at the top of the instruction and Escape remain available at any time, including inside dialogs and with invalid fields. Exit saves progress and closes task dialogs; use the same menu command to resume.

After a task is completed, the guide shows the changed slide or section on the canvas. Settings close, the result is highlighted, and the instruction identifies its number and title. «Изменить ещё» (Edit again) returns to the same element's settings; Next opens the following task.

Changes apply to the current project and support Ctrl+Z. For the final task, return from preview using Edit, then download HTML. Failed preview or export attempts do not count.

## Templates and individual elements

Use the outline on the left to add, rename, duplicate, move and delete sections or slides. Edit in the centre canvas and open properties on the right.

Use an add button to open the catalog. Browse templates and compositions, individual components, or materials. Search template names, descriptions and fields, then filter by category or choose a corporate preset. To reuse a section or slide, select «Сохранить как композицию» (Save as composition) and find it under «Мои композиции» (My compositions).

«Посмотреть шаблоны» (View templates) replaces the selected structure and carries over matching blocks. If some blocks have no matching place, keep the current composition or store those blocks in the project. The editable backup includes stored blocks. Restore them into a new section or slide through the inspector. «Изменить компоновку» (Change layout) compares arrangements of the existing blocks.

Edit text on the canvas or under «Содержание» (Content). Use «Внешний вид» (Appearance) for colours, alignment and component styling. For a website text block, this group also contains typography settings for font, size, colour, style and spacing. The «Анимация» (Animation) group controls motion. Website section settings include the background image under «Внешний вид» (Appearance) and grid and cropping under «Дополнительные параметры» (Additional settings).

## Images and slides

Saving a composition to the catalog clears link destinations and button actions in its copy while preserving their labels. The source project keeps its links and actions. Assign new destinations after inserting the composition.

Transfer your saved compositions through Templates and compositions → «Перенос моих композиций». Download the collection, then import that file in the same dialog in another browser. The collection includes both document types and local images. Repeated imports add independent copies.

Each unplaced block in section settings has a «Разместить в разделе» destination field. Choose a section or slide and click «Разместить блок». Constructor finds available space using the block's original size. When space is insufficient, the block stays in the reserve. Placement supports Undo and Redo.

Choose a library asset or upload PNG, JPEG, WebP or GIF up to 2 MB. To crop, select the fill mode and drag the image inside its frame. Mobile focus is configured separately. Contain mode keeps the whole image visible.

Slides use a 1600×900 source canvas and scale as a whole. In «Оформление» (Design), choose «Этот слайд» (This slide) or «Все слайды» (All slides) to set the scope of automatic fitting. Fitting proposes background and placement while preserving text. If content overflows, edit it or split the slide manually.

The compact single-line «Заголовок слайда» / «Заголовок секции» field names the section in the outline and settings. The name stays in the editable project but adds no text to the canvas, preview or finished HTML. Headings and text inside elements are edited separately on the canvas or through block properties. These values are independent: editing one does not change the other, an empty title is not filled from a text element, and matching values are not automatically removed. Opening settings or changing the grid preserves existing line breaks.

## Actions and motion

A button can open a link, navigate to a section or slide, or control a modal. Recheck action targets after deleting content. Editing reveals all content; motion plays in preview. «Далее» and «Назад» navigate presentation steps. Reduced motion and printing preserve access to content.

## AI drafts

Open «Создать с ИИ», choose a fragment or document, then supply a request and source facts. Limits are five website sections or six slides. Review the proposed outline and the completed draft. Some text is inserted verbatim from supplied facts; this is disclosed in the draft.

Drafts are isolated from projects. Edit them, retry a section, cancel or resume generation. Slides also support automatic fitting. Acknowledge the content review before applying. A fragment is inserted as one undoable operation; a complete document creates a new project.

## Before delivery

Wait for «Сохранено» (Saved). Check websites on mobile and presentations in full screen. Select «Скачать копию (.json)» (Download a copy) next to «Скачать HTML» (Download HTML). On mobile, both actions are in the «Файл» (File) menu. Import JSON to edit the project in another browser. Use HTML to share the finished output. External HTTP(S) assets require a network. Use browser printing for PDF and check that each slide occupies a separate page.

## Tablet and phone sizes

Select a block and hover over its boundary to see the resize cursor. Drag a side to change width, the top or bottom to change height, or a corner to change both. The opposite edge stays anchored. Hold the left mouse button inside a selected block to drag it. Hold Shift to constrain movement to one axis. Escape cancels a drag and Undo restores an applied change. Double click text to edit it; Escape returns control to the block.

Open «Привязка» in the canvas view controls to set horizontal and vertical steps independently, starting at one column and one row. You can also show the grid. «Настроить сетку раздела» opens the current section or slide's advanced grid settings. Grid edits are saved in the project and support Undo. Drag steps and grid visibility are browser preferences.

«Привязка → Режим привязки» offers three modes. Strict snaps either edge to the nearest horizontal and vertical line, including both sides of gutters. Off allows free movement and resizing, including the canvas margins. Mixed preserves free geometry and attracts an edge only within 6 screen pixels of a line. Blue guides show active magnets; full grid visibility is independent. In Off and Mixed modes, arrows move by 1 px, Shift accelerates movement to 10 px and Alt with arrows resizes. Block properties show precise pixel coordinates and dimensions. The browser stores the mode; projects and HTML/PDF retain geometry.

Flow section heights expand with content. On tablet and phone canvases, the right and bottom boundaries edit responsive sizes, while dragging inside a block changes reading order. All edges and corners are available in desktop grid layouts and on slides.

The «Привязка» button stays highlighted while its panel is open. Info buttons reveal explanations; hovering a mode or navigating options with arrows shows its hint. Step controls appear only in Strict mode. Click outside, click the trigger again or use the close button to dismiss the panel. Escape closes the list or hint first, then closes the panel and returns focus to its trigger. Resizing a block preserves text size; responsive typography follows the document viewport.

Choose a screen in «Вид холста», open block properties and expand «Размер и расположение» (Size and position). Set percentage width and minimum pixel height independently for tablet and phone. Content can grow beyond the minimum height. «Автоматический размер» resets only the current screen. These settings apply to flow website sections. The desktop grid and slide geometry have their own settings.

On tablet and phone canvases, arrows on a focused block change reading order. Alt with left/right adjusts width by 5 percentage points; Alt with up/down adjusts minimum height by 16 px. Shift increases the step tenfold. Escape cancels an active drag; Undo restores an applied size. Simulated device widths stay stable when properties open; use canvas scrolling or «Вписать» when space is limited.

Use Tab to focus a block or single click anywhere on it, including its text. Double click to edit text; Escape returns focus to the block. In grid layouts, arrows move it by the configured snapping step, Shift increases the step tenfold and Alt with arrows changes width or height. A held arrow undoes as one gesture; separate key presses remain separate history entries. Enter opens block settings. Settings, copy and delete buttons support keyboard and screen reader access. Closing properties returns focus to the invoking element.

## Keyboard shortcuts

Open «Проект → Горячие клавиши», press F1 or «?» for the complete list. On macOS use Cmd instead of Ctrl. Letter shortcuts also work with the Russian keyboard layout.

| Shortcut | Action |
| --- | --- |
| Ctrl+C / Ctrl+X / Ctrl+V | Copy, cut and paste the selected block |
| Ctrl+D | Duplicate the block |
| Delete / Backspace | Delete the selected block |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Arrows / Shift+arrows | Move by one step / ten steps |
| Alt+arrows / Alt+Shift+arrows | Resize by one step / ten steps |
| Ctrl++ / Ctrl+− / Ctrl+wheel over the canvas | Change canvas zoom |
| Ctrl+0 / Shift+0 | Canvas zoom 100% |
| Shift+1 | Fit canvas |
| Ctrl+Enter | Open preview |
| Ctrl+S | Download a project copy |
| Escape | Finish editing, close the panel or clear selection |

Block copy uses the system clipboard: paste repeatedly, into another section or another Constructor tab. Pasting preserves content, creates a new ID and finds free space in the destination grid. Invalid data and insufficient space leave the document unchanged. While editing text, clipboard actions, undo and arrows retain their normal text behavior. Dialogs and selection menus handle their own keys. Brand template geometry is editable in advanced mode.

## Standard grid

In the editor, the desktop screen uses the configured canvas width (1920 px by default). Opening properties or changing zoom does not activate tablet columns. The canvas initially fits the workspace; «Масштаб 100%» restores actual size with scrolling. Tablet and phone explicitly select their responsive columns.


New websites and presentations use the Figma grid: 24 columns of 64 px at a 1920 px width, 8 px gaps and 100 px side margins. Slides measure 1920×1080 with a 176 px top inset and 48 px bottom inset, leaving 12 rows of 64 px. Websites grow with content, using 12 columns on tablets and 4 on phones by default. These responsive counts are configurable web implementation defaults.

The grid is shared across the document: changes apply to all inheriting sections and new sections/slides. Enable «Своя сетка для этой секции» or «Своя сетка для этого слайда» for an explicit exception; clearing it restores the common grid. All templates and catalog compositions use the standard grid and inherit the destination document grid when inserted. Saving a composition to the catalog leaves the source project unchanged. Opening preserves every section's saved grid and positions, including legacy websites and presentations. When no common grid is recorded, the first section supplies it and differing section grids become overrides. Apply grid parameters or the standard grid explicitly to convert an older project.

Presentations use the same guides, snapping modes and zoom as websites. «100%» shows actual canvas pixels, while «Вписать» fits the slide into the workspace. Opening settings and resizing the window do not change the column count. Slides retain their fixed 16:9 format.

Open «Привязка → Настроить сетку раздела» to edit columns, rows, gaps, margins and website responsive counts. Fill in the fields, then press «Применить сетку». Blocks are mapped to the new cells; slides compact when needed while respecting widget minimum sizes. Text, images and actions are preserved. Invalid configurations show a local error and retain the entered values for correction. «Отменить изменения сетки» restores the applied parameters. Resetting the standard grid also works with invalid input. Closing settings or switching sections applies a valid draft; invalid drafts keep the current form open. «Применить стандартную сетку» restores the standard and reprojects block positions. Grid changes are saved in the project and support Undo.

## Slide header and page number

In slide settings, open «Оформление» (Design) and expand «Подпись и номер слайда» (Slide header and number). Headers share the same insets and type size across slides. Edit the text or hide it. Empty text restores ALABUGA / project title. Numbers support visibility, format (01, 1 or 1 / total), bottom alignment and custom text. Empty values use the automatic slide order, including after reordering. Changes affect the current slide, support undo, persist in the project and appear in HTML/PDF.

Page numbering also offers independent Background and Text color controls. Choose transparent or a brand background and a separate text color; select From theme to restore automatic text color. Solid backgrounds add a small inset around the number.
