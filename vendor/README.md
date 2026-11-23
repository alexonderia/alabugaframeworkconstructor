# Local Framework artifact

`alabuga-framework-1.4.0-grid.4.tgz` is the built public package from the sibling `../alabuga-framework` repository. It adds opt-in grid frames and responsive columns (schema 6), plus explicit precise placement with `position.free: true` (schema 7). It has not been published to a registry.

Constructor imports only the package's public exports. The archive contains built JS, CSS, declarations, fonts and assets, not a copy of the Framework source tree. npm's package-lock.json pins its integrity and all workspaces consume the same archive. Docker copies `vendor/` before dependency installation.

To rebuild after reviewing changes in the sibling repository, run `npm run build` there and `npm pack --ignore-scripts --pack-destination ../alabugaframeworkconstructor/vendor`. Update the lockfile's archive integrity and rerun compatibility, build and grid checks. The implementation and design provenance are described in `docs/grid-standard-iteration.ru.md`.
