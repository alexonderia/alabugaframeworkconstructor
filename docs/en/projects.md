# Projects, assets and workspace

## Gallery, routes and storage

The gallery separates websites and presentations. The + card creates an empty project, sample copy or AI draft; cancellation leaves no empty project. Import always creates a separate project. Previewing a thumbnail does not change its modified date. Cards support editing, renaming, portable download and trash. Search matches names and sorting uses modification date or alphabet; both sections stay visible during search.

Routes are #/projects, #/edit/ID, #/view/ID and #/trash. Reload and browser back/forward work. Leaving the editor waits for pending writes; errors keep it open with retry and project download.

IndexedDB belongs to this browser profile and origin. Download portable projects for backup; HTML is final output. Clearing browser data removes projects. Trash retains revisions, has no automatic expiry, and can restore a project. Permanent deletion requires confirmation, removes its revisions and draft, preserves shared assets and records a tombstone so another tab's autosave cannot recreate it.

Database version 2 keeps ProjectSummary metadata in the same transaction as documents. Legacy projects, revisions and assets remain; localStorage migration is one-time and preserves the original. The gallery loads summaries and creates thumbnails on visibility, with at most eight live renderers.

## Working on the canvas

Sections/slides are on the left, canvas in the center and properties on the right. Properties do not block the canvas. Reorder by dragging, arrow controls or Alt+arrows on thumbnails. Zoom changes the working view only.

Choose corporate or uploaded images/backgrounds in one dialog. Crop by dragging or arrow keys; mobile has an independent focal point. focalPoint/mobileFocalPoint store percentages 0–100. Corporate originals and regeneration now belong to Framework, while Constructor receives prepared assets from its installed package. The [asset manifest](/assets/brand/manifest.json) records checksums, dimensions, transparency and slide numbers. See [brand provenance]({{FRAMEWORK_DOCS_URL}}docs/en/brand.html).

The original presentation has 28 slides, 67 media entries, 65 unique materials, five charts and one table. Source assets include real logos, backgrounds, photographs and geometric graphics. Small raster lettering and UI screenshots remain reference-only. SVG stays vector; portable copies remove scripts, external links and foreignObject. Original source files are unchanged; charts are not editable imported components.

Confirmed brand rules are Alabuga Sans, large expanded headings, blue/white, geometry, asymmetry and logo clear space. Muller Medium appears in the source PPTX; the browser uses normalized Alabuga Sans. Figma tokens remain. The 12-column grid, responsive layouts, 28/64/96 px spacing, dark overlays, motion and editor UI are implementation decisions, not extra official brand rules. Framework showcase documents use graphics and editable text without attributing corporate achievements to the product.

Eight composition families cover title, asymmetry, thesis/divider, text/image, editorial benefits, metrics, stages and final action. Header/footer, table, quote and gallery complement them. Websites size to content; presentations retain 16:9.

## Revisions, motion and quality

«Сохранено» appears only after the transaction completes. Images are stored separately by SHA-256. A revision is created after 30 idle seconds; up to 20 per project are retained. Replacing or restoring saves the current state first. Documents 1/2 normalize to 3; localStorage is retained. Portable JSON includes unique assets; HTML embeds local assets and fonts. External HTTP(S) images still need a network.

Motion presets include thesis emphasis, sequential reveal and image-then-explanation. List order determines steps; «Вместе» groups with the previous step. Advanced properties expose step numbers. Preview starts at the beginning on every run; reduced-motion and print reveal all content. Quality checks locate overflow, unavailable images, missing action targets and insufficient contrast on solid backgrounds; findings open the relevant element. Photographic contrast still needs visual review. Content is never automatically shortened.

## Author acceptance: not conducted

The original protocol requires five independent participants. Each builds a five-section page and six-slide deck, changes two images, crops one for mobile, groups/reorders motion, saves/reopens and exports HTML. Record time, unassisted completion and confusing steps. Target: four of five finish all tasks without assistance. Automated tests do not count as this study.

| Participant | Page / slides | Assets / presentation | Export | Assistance / obstacles |
| --- | --- | --- | --- | --- |
| 1 | Not conducted | Not conducted | Not conducted | — |
| 2 | Not conducted | Not conducted | Not conducted | — |
| 3 | Not conducted | Not conducted | Not conducted | — |
| 4 | Not conducted | Not conducted | Not conducted | — |
| 5 | Not conducted | Not conducted | Not conducted | — |

The shorter gallery task checks creating a sample site and changing a heading, making a two-slide deck, finding/previewing it, importing a downloaded site as a separate copy, renaming/trashing/restoring that copy, and locating properties/preview/back on a phone. Record each participant's completion, time and unclear labels. It also remains unperformed.

See [authoring](author.md), [storage recovery](data.md), [AI](ai.md) and [slide fitting](slide-fit.md).
