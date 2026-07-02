/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-callables channel fixture (CB #2501) — a minimal `chromeBindings`
// module the CB test cases point `settings.chromeBindingsModule` at.
//
// Overrides `buildFrontmatterPreviewEntries` so the FrontmatterPreview
// table (which today never renders on an injected route — the package
// default is `() => []`) becomes visible, proving the host-callables channel
// reaches `createChrome` on the injected doc route.
//
// Overrides `docContentHeaderExtras` (CONFIRM #2505) with a frontmatter-keyed
// badge sourced from `entry.data.tier` — proving the seam reaches
// `DocContentHeader` on an injected doc route and renders between `<h1>` and
// the metainfo block (see `docContentHeaderExtras` doc comment in
// `doc-content-header/index.tsx`).
//
// Also overrides `docHistoryMeta` with a fixed entry keyed to the
// "getting-started" doc slug so DocMetainfoArea has data to render (the
// fixture ships `docMetainfo: false`; the CB test flips it to `true` for
// this proof) — this gives the positional assertion a REAL metainfo block to
// assert against instead of relying on the slot's absence.
//
// Every other `ChromeHostBindings` slot is left at its package-default stub.

import type { ChromeHostBindings } from "@takazudo/zudo-doc/factory-context";

export const chromeBindings: ChromeHostBindings = {
  buildFrontmatterPreviewEntries: () => [
    ["cb-demo-key", "CB-DEMO-VALUE-MARKER"],
  ],
  docContentHeaderExtras: ({ entry }) => (
    <div class="doc-content-header-extra-marker">
      DOC-HEADER-EXTRA-MARKER: {String((entry.data as Record<string, unknown>).tier ?? "")}
    </div>
  ),
  docHistoryMeta: {
    "getting-started": {
      author: "CB-AUTHOR-MARKER",
      createdDate: "2024-01-01T00:00:00Z",
      updatedDate: "2024-06-01T00:00:00Z",
    },
  },
};
