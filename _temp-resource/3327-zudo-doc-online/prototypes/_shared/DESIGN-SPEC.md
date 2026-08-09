# zudo-doc online — prototype design spec (round 1)

Throwaway UI prototypes for the "zudo-doc online" web app (zudolab/zudo-doc#3326):
a web app where users create a zudo-doc documentation site, outline it as a nested
list (top page → header big categories → sidebar pages), edit pages in a
markdown editor + preview split pane, autosave drafts, and publish explicitly.

Round 1 explores TWO surfaces, N layout variants each:

- **Surface A — page editor** (`proto-page-editor/`): the daily-driver editing screen.
- **Surface B — outline editor** (`proto-outline/`): the site-structure authoring screen.

## Hard rules (every variant)

1. **One self-contained `.html` file.** All CSS/JS inline. No build step. External
   network allowed ONLY for the CodeMirror CDN imports (Surface A, see recipe) — and
   the page must still look complete if those fail (fallback below).
2. **Inline the ENTIRE contents of `_shared/tokens.css`** in a `<style>` at the top,
   then component styles below. Components use **only `--theme-*` / `--font-*` /
   `--radius-*` / `--shadow-*` vars** — never `--palette-*` directly, never raw
   hex/oklch literals (exception: `color-mix(in oklch, var(--theme-*) N%, transparent)`
   for overlays/hover washes is encouraged).
3. **Variant badge**: fixed bottom-right floating pill showing the variant id
   (e.g. `A-v3 tabbed-workspace`) + a working **light/dark toggle** button that flips
   `data-theme` on `<html>` (default `light`).
4. Desktop-first: design for 1280–1600px wide. Don't invest in responsive behavior.
5. Vary **layout/structure/density/chrome** between variants — NOT palette. All
   variants share the same tokens so they're comparable.
6. Realistic content (samples below), believable states. English UI text.
7. Interactivity floor: theme toggle must work. Everything else may be visual-only
   (static), EXCEPT the per-surface required behaviors listed below. Prefer looking
   right over behaving right — this is layout judgment, not engineering.
8. Accessibility basics even in prototypes: real `<button>`s, focus-visible outlines
   (`outline: 2px solid var(--theme-accent)`), sensible landmarks.

## App-wide fictional context

- App name: **zudo-doc online** (wordmark text is enough; a 20×20 rounded square with
  "z" works as logo).
- Current project: **Aurora Docs** — a documentation site being authored.
- Current user: avatar circle with initials "TZ" (no auth UI needed).

## Site structure sample (both surfaces)

```
Aurora Docs
├─ (top page)                      ← generated category grid, not directly authored
├─ Getting Started                 ← header big category (dir: getting-started)
│  ├─ index        "Getting Started"    (category page)
│  ├─ introduction "Introduction"
│  ├─ installation "Installation"       ← the page open in Surface A
│  └─ quick-start  "Quick Start"
├─ Guides                          ← header big category (dir: guides)
│  ├─ index             "Guides"
│  ├─ writing-pages     "Writing Pages"
│  ├─ sidebar-structure "Sidebar Structure"
│  ├─ theming           "Theming"
│  ├─ i18n              "Internationalization"
│  └─ publishing        "Publishing"
└─ Reference                       ← header big category (dir: reference)
   ├─ index       "Reference"
   ├─ config      "Configuration"
   ├─ frontmatter "Frontmatter"
   └─ cli         "CLI"
```

Draft/publish states to sprinkle for realism: `installation` = draft (unsaved edits),
`theming` = draft (never published), everything else = published.

## Surface A — page editor

The user edits ONE page (`getting-started/installation`) as markdown+MDX in a
**CodeMirror editor + rendered preview, left-right split**.

Required elements (arrange however the variant's concept dictates):

- Editor pane (CodeMirror; see recipe) with the sample markdown below.
- Preview pane: the same content **pre-rendered as static HTML** (hand-write the
  HTML; typographic quality matters — headings, code block, note admonition, list).
  Live re-rendering NOT required. If cheap, a fake "refresh on edit" shimmer is a
  nice touch, not required.
- Page metadata as **form fields, not frontmatter text in the buffer**: Title
  ("Installation"), Description, sidebar position. Where they live is a key variant
  decision (toolbar row? collapsible panel? side sheet?).
- **Save-status chip** (honest save model): cycles `Saved → Edited → Saving… → Saved`.
  Required behavior: typing/clicking in the editor flips it to "Edited", then a fake
  1s timer → "Saving…" → "Saved". Small, always visible.
- **Publish affordance** with derived status, distinct from save status: e.g. button
  `Publish` + hint `Published 2d ago · 2 pages changed since`. Publishing ≠ saving —
  make that legible.
- Some way to know **which page** you're on and switch pages (tree rail, tabs,
  breadcrumb + dropdown, command-palette hint — per variant concept).
- A place where **vim mode** state could live (e.g. a statusbar slot or toggle) —
  visual only.
- Split divider (drag optional; visual affordance required).

### Sample markdown (editor buffer content)

```markdown
Aurora Docs runs on any machine with Node 22+. This page walks
through installing the toolchain and creating your first project.

## Prerequisites

- Node.js 22 or newer
- pnpm 9 (`corepack enable pnpm`)
- A GitHub account for publishing

## Install

```bash
pnpm create aurora-docs my-docs
cd my-docs
pnpm dev
```

:::note
The dev server starts on port 4321. Pass `--port` to change it.
:::

## Next steps

1. Open `src/content/docs/` and edit your first page
2. Adjust the sidebar in the outline editor
3. Hit **Publish** when it looks right
```

### CodeMirror CDN recipe (use EXACTLY this, with fallback)

```html
<script type="module">
const DEPS = "@codemirror/state@6.5.2,@codemirror/view@6.38.1,@codemirror/language@6.11.0";
try {
  const [{ EditorView, basicSetup }, { markdown }] = await Promise.all([
    import(`https://esm.sh/codemirror@6.0.2?deps=${DEPS}`),
    import(`https://esm.sh/@codemirror/lang-markdown@6.3.2?deps=${DEPS}`),
  ]);
  const view = new EditorView({
    doc: SAMPLE_MARKDOWN,
    parent: document.querySelector("#editor"),
    extensions: [
      basicSetup,
      markdown(),
      EditorView.lineWrapping,
      EditorView.updateListener.of(u => { if (u.docChanged) onEdited(); }),
      EditorView.theme({
        "&": { height: "100%", fontSize: "13.5px" },
        ".cm-scroller": { fontFamily: "var(--font-mono)" },
        "&.cm-editor": { backgroundColor: "transparent", color: "var(--theme-fg)" },
        ".cm-gutters": { backgroundColor: "transparent", color: "var(--theme-muted)", border: "none" },
        ".cm-activeLine": { backgroundColor: "color-mix(in oklch, var(--theme-accent) 6%, transparent)" },
        ".cm-cursor": { borderLeftColor: "var(--theme-accent)" },
      }),
    ],
  });
} catch (e) {
  // CDN failed: fallback textarea so layout judgment still works
  const ta = document.createElement("textarea");
  ta.className = "cm-fallback";
  ta.value = SAMPLE_MARKDOWN;
  ta.addEventListener("input", onEdited);
  document.querySelector("#editor").replaceChildren(ta);
}
</script>
```

Style `.cm-fallback` (100% size, `var(--font-mono)`, transparent bg, no resize) so the
fallback looks close. The editor container must sit in a proper flex/grid height chain
(`min-height: 0` on flex children!) so CM never collapses to 0px.

## Surface B — outline editor

The user authors the site structure as a **nested list** (max 2 levels: category →
page; the top page is derived, shown as a fixed root). Use the site structure sample.

Required elements:

- The outline itself with visible affordances for: add category, add page, rename,
  reorder (drag handle or up/down), delete. Non-functional is fine but affordances
  must be visible (hover-revealed is OK — then show one row in its hover state
  hard-coded, or note it).
- **Level semantics made legible**: which node becomes a header category vs a sidebar
  page vs the derived top page. Use chips/badges/slugs (e.g. `getting-started/`)
  per the variant concept.
- Draft/published state markers on pages (dot, chip — subtle).
- A header area: project name "Aurora Docs", back-to-dashboard affordance, and a
  "structure saved" status (same honest-chip idea, may be static "Saved").
- Per the variant concept, a **structure consequence preview** (what the outline
  produces: header nav / sidebar / top-page grid) — some variants center this, some
  omit it; follow the concept brief.

## Deliverable per agent

ONE file at the exact path given in your brief. Return (per your output schema):
the file path, a 1-line concept summary, what interactive bits actually work, and
any deviations from this spec.
