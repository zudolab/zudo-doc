# Assets index — approved UI prototype (Variant A · Tree)

Design reference for zudolab/zudo-doc#3775. Delete this directory before the epic's root PR merges into `main`.

Built 2026-08-31 during `/big-plan`. The user reviewed three rendered variants and chose **A**.
The pages below are the real built asset-page shell (header with an active "Assets" item,
breadcrumb, footer) with the index UI swapped into the content band, so tokens and chrome
render exactly as they will in production. The islands bundle is stripped, so the theme
toggle is inert — `a-tree-dark.html` is the dark rendering.

- `a-tree.html` / `a-tree-dark.html` — **the chosen design**. Real built asset-page shell
  (header with an active "Assets" item, breadcrumb Home › Assets, footer) + the index UI.
- `build.py` — regenerates the pages from a built `dist/` (reads the real `public/assets/demo` sizes).
  Run from the repo root after `pnpm build`; set `ZUDO_DOC_ROOT` to point elsewhere.
- `styles.css` — a copy of the built site stylesheet so the pages open via `file://`.

Design contract of Variant A (what the implementation must reproduce):

- Page header reuses the asset-page header pattern: eyebrow pills (`ASSETS` · `INDEX`),
  mono H1 `Assets`, meta line `N files · M folders · total size`, one-line description.
- Toolbar row: left `public/<assetViewerDir>/` (mono, muted); right `Expand all` / `Collapse all`.
- Tree: nested `<ul>`; each folder is `<details open><summary>` with chevron (rotates 90° when open),
  folder icon (closed/open variants), `name/` in mono, right-aligned muted meta `N files · size`.
- File rows: invisible chevron placeholder for alignment, kind icon (code / text / image / video /
  pdf / archive / generic), mono file name linking to the viewer page, right-aligned muted meta
  `TYPE · facet · size` (facet = `N lines` | `W × H` | `m:ss`).
- Nested levels indent with a 1px guide line (`color-mix(currentColor 18%)`); rows get a subtle hover bg.
- Icons: 24×24 stroke `currentColor` SVGs, same style as the header chevron. Paths are in `build.py` (`P` dict).
- Meta column hides under 40rem viewport.
- Only `demo/` exists in the showcase today; the other folders in the prototype are sample data.
