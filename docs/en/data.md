# Data and recovery

## Project location

The `alabuga-workspace` IndexedDB database stores projects, assets, revisions, settings and gallery summaries. Storage belongs to a browser profile and origin: scheme, hostname and port. `localhost` and `127.0.0.1`, and ports 5173 and 4176, are separate storage locations. The container does not contain this database.

“Saved” is shown only after a successful transaction. Preview and thumbnails do not update project modification dates. On write failure, stay in the editor, retry saving or download a portable project.

## Backup

Download a project file from the gallery or editor. It contains the document and required local assets and remains editable. Exported HTML is a finished result, not a replacement for a portable project. External HTTP(S) images remain external; upload them into the library before export if independent delivery is required.

Before changing the domain, port, browser or profile, or clearing browser data, download your projects. Open the new address and import them. There is no automatic cross-origin transfer or device synchronization.

## Revisions and trash

Up to 20 revisions are retained after an editing pause, when leaving and before restoration or replacement. Restoring a revision first preserves the current one. Trash retains projects and revision history without automatic cleanup. Permanent deletion requires separate confirmation and preserves assets shared with other projects. Autosave in another tab must not silently resurrect a deleted project.

## Compatibility

Documents with responsive size overrides use schema 4 (Framework 1.2+). Legacy documents without overrides still normalize from schemas 1–3 to 3; explicit schema 4 is preserved. Framework 1.1 readers reject schema 4. Portable project envelopes remain version 3. IndexedDB version 3 adds the revisions.project index and migrates databases 1?2 without rewriting their documents. Legacy local storage is migrated once. Future schema changes require explicit migrations and tests against old documents. If a database upgrade is blocked, close other tabs and reopen.

## Undo and recovery

Undo covers the active editor session; revisions and portable files provide longer-term recovery. AI drafts are saved separately and recover after reload. Do not clear browser data to troubleshoot an error before creating backups. Supply a minimal reproducible project when reporting problems.

## Compatibility after the split

The database name alabuga-workspace and object stores stay unchanged; version 3 adds an index by project for revisions. The legacy alabuga.builder.document.v1 key is retained. Documents 1–3 normalize to 3; project envelopes 1–3 and missing version remain readable. Future versions and missing assets fail before storage writes. First startup does not bulk-rewrite projects. Installed-collection markers, revisions, trash, tombstones and AI drafts remain.

Concurrent writes check an internal project version in the transaction. A stale tab must save a separate copy or open the saved document. The storage dialog lists asset usage and rechecks all projects, trash, revisions and AI drafts before deleting selected unused assets. Manual recovery points are available from the project menu.

Slide header and number settings (`page.chrome`, Framework 1.3+) use document schema 5 and require Framework 1.3 or later to reopen. Documents without these settings keep their previous version 3/4 normalization. Portable project envelopes and IndexedDB remain at version 3.

Independent page number background and text colors require Framework 1.3.1 or later and remain in document schema 5.
