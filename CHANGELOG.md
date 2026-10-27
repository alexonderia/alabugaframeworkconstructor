# Changelog

## Unreleased

Keep one active set of block controls and render its toolbar outside clipped authored sections. Preserve its screen size at canvas zoom, use separated free space and avoid neighboring widgets when positioning handles. Make section actions a compact icon list with a 12 px trigger gap, keyboard opening, Escape/focus restoration and outside-click closing. Close before applying an action so reordering cannot leave the menu open when that action becomes disabled.

Remove the collapsed grid heading margin. Center and fit composition previews inside padded Framework cards, with shared resize cleanup. Replace visible browser file controls with Framework upload actions while retaining native file events and accessible names. Use action icons for closing, copying and deleting, and retain a continuous pointer path to compact block tools.

Space expanded settings headings from the complete field, including its caption. Share the 16 px disclosure gap across motion, grid and advanced slide settings without doubling grid spacing; verify narrow layouts, expanded text spacing and collapsing.

Keep block settings, copy and delete reachable while the pointer crosses the toolbar gap; retain the selected block toolbar. Test continuous pointer travel, action results and undo, canvas zoom, and selected versus unselected hover/focus visibility.

Keep gallery and preview layout/content intact while a project and its editor preferences load. Dispose the previous surface and switch layout only when the replacement mounts; block field input while navigation is pending and restore interaction after success or failure. Add delayed-read regressions for both entry paths and preview navigation.

Pin the public Framework 1.2.0 package. Add independent tablet/mobile widths and minimum heights, keyboard/pointer resizing, automatic size reset and schema 4 round-trip through projects and standalone HTML. Preserve schema 3 for documents without overrides. Keep simulated device widths stable while opening properties, refresh their scope after switching devices and retain invalid drafts. Hide decorative catalog glyphs from screen readers. Verify native Chrome zoom and NVDA separately from viewport/axe checks.

Keep material, history, quality and storage dialog headings visible while their content scrolls, with separate storage actions. Wrap long material names and URLs, preserve focus after selection/closing, and disable deletion when no materials are selected, including after cleanup. Add responsive interaction and accessibility regressions to browser and Docker acceptance.

Extend this layout to gallery forms, help, deletion confirmation and composition/layout pickers. Keep form submission working with Enter, return rename focus to the same card after refresh, fit variant grids at 320 px and clear stale gallery notifications when navigating to the editor.

Keep catalog closing and save-conflict actions available while content scrolls. Restore outline-menu focus after private-name editing, retain input on write failure, prevent duplicate pending writes and keep a visible copy suffix for 200-character project titles. Add public-UI regressions for conflict recovery across two tabs and local draft downloads.

Update the exact Framework dependency from 1.0.2 to 1.1.0 across Constructor workspaces and the lockfile.

Require Framework 1.1.0 for managed UI component lifecycle and calendar DatePicker. Protect project writes with atomic versions and conflict recovery, checkpoint short sessions, and share validated file import between gallery and editor. Migrate IndexedDB 1–2 to version 3 with indexed revision history, batched asset hydration, bounded material caching and reference-checked asset cleanup.

Use the public standalone runtime in an isolated preview with real viewport widths, selected-slide restoration and shared export preflight. Fix copied section links, meaningful/private structure labels, asset loading/retry/search/descriptions, AI readiness states, live save announcements and duplicate editable landmarks. Simplify mobile tools and properties, offer dismissible guidance, name exported files after projects and support Ctrl/Cmd+S in inputs. Add integration regressions, production checks and RU/EN documentation.

Keep showcase diagnostics closable while reports and previews scroll, cancel requests on close and restore focus. Mount demo samples before rendering and reserve slide proportions to avoid WebKit ResizeObserver height cycles. Retry transient Windows locks when atomically publishing model setup progress; preserve resumable weight downloads. Add public-UI diagnostics and bounded state-publication regressions.

Retain AI section topics separately from outline premises, ground short prose in relevant source facts, avoid repeated shared-fact cards and preserve explicitly requested metric units without filling extra slots. Detect additional wrong-topic, procedural, comparison and repeated-copy failures. Record real-model request traces and render only current-run editorial assessments; the 20-task editorial target remains unmet.

Ground AI field meanings in the prompt, improve unreviewed headings while preserving author-confirmed titles, align new outline premises to their topics, and prevent repeated source paragraphs across sections. Build same-property comparison cells and distinct action cards from validated source references, with explicit provenance. Add separate control fixtures and reporting; the current content target remains unmet (14/20, control 4/6).

## 0.7.0

Constructor remains in the original repository and installs independently published Framework 1.0.2. Document schemas 1–3 and IndexedDB version 2 are preserved.
