# zudo-doc online — prototype design spec (round 2)

Round 2 of the throwaway UI prototypes for "zudo-doc online" (zudolab/zudo-doc#3326).
Round 1 covered the page editor (A) and outline editor (B); their winners are already
implemented in `packages/zudo-doc-online/`. Round 2 explores the two remaining surfaces:

- **Surface C — creation wizard / theme picker** (`proto-wizard/`): the flow that turns
  "I want a docs site" into a created project. Core decisions: name, theme pack,
  color scheme/mode, curated feature set. Output of the real flow = a preset JSON
  executed server-side.
- **Surface D — dashboard / project library** (`proto-dashboard/`): the app's home.
  List projects newest-first, open one, create a new one, duplicate/delete with inline
  confirm, and show busy/recovery states honestly.

## Hard rules (every variant — same as round 1 unless noted)

1. **One self-contained `.html` file.** All CSS/JS inline. No build step, and for
   round 2 **no external network at all** (neither surface needs CodeMirror).
2. **Inline the ENTIRE contents of `_shared/tokens.css`** in a `<style>` at the top,
   then component styles below. Components use **only `--theme-*` / `--font-*` /
   `--radius-*` / `--shadow-*` vars** — never `--palette-*` directly, never raw
   hex/oklch literals. Two exceptions:
   - `color-mix(in oklch, var(--theme-*) N%, transparent)` overlays/washes: encouraged.
   - **Sample-data colors** (theme-pack swatches and the mini site thumbnails derived
     from them, §"Theme packs") are CONTENT, not chrome — use the literal oklch values
     from the data table, ideally injected from the JS data array via inline
     `style="--pack-bg: …"` custom props so the chrome CSS itself stays literal-free.
3. **Variant badge**: fixed bottom-right floating pill showing the variant id
   (e.g. `C-v1 stepper-rail`) + a working **light/dark toggle**. Use exactly this
   pattern so all variants match:

   ```html
   <div class="proto-badge">
     <span>C-v1 stepper-rail</span>
     <button id="themeToggle" type="button">◐ theme</button>
   </div>
   <script>
     document.querySelector("#themeToggle").addEventListener("click", () => {
       const r = document.documentElement;
       r.dataset.theme = r.dataset.theme === "dark" ? "light" : "dark";
     });
   </script>
   ```

   ```css
   .proto-badge { position: fixed; right: 16px; bottom: 16px; z-index: 99;
     display: flex; gap: 8px; align-items: center; padding: 6px 10px;
     background: var(--theme-surface); border: 1px solid var(--theme-border-strong);
     border-radius: 999px; box-shadow: var(--shadow-2); font-size: 11px;
     font-family: var(--font-mono); color: var(--theme-muted); }
   .proto-badge button { font: inherit; color: var(--theme-fg-mild);
     background: none; border: 1px solid var(--theme-border-strong);
     border-radius: 999px; padding: 2px 8px; cursor: pointer; }
   ```

   `<html>` starts with `data-theme="light"`.
4. Desktop-first, 1280–1600px. Don't invest in responsive behavior.
5. Vary **layout/structure/density/chrome** between variants — NOT palette. All
   variants share the same tokens so they're comparable.
6. Realistic content (samples below), believable states. English UI text.
7. Interactivity floor: the theme toggle must work, plus the per-surface required
   behaviors below. Everything else may be visual-only. Prefer looking right over
   behaving right.
8. Accessibility basics: real `<button>`s, `:focus-visible { outline: 2px solid
   var(--theme-accent) }`, sensible landmarks.

## App-wide fictional context (same as round 1)

- App name: **zudo-doc online** (wordmark text; a 20×20 rounded square with "z" as logo).
- Current user: avatar circle with initials "TZ". No auth UI.
- Unless the variant concept is deliberately full-screen/immersive, show a slim app
  top bar (wordmark left, avatar right; Surface C also gets a "← Projects" escape).

## Theme packs (sample data — both surfaces)

The real product has **31 theme packs**; prototypes show these 12 and, where the
concept has room, a "+19 more" affordance. Copy this array verbatim into the page JS
and derive all swatches/thumbnails from it:

```js
const PACKS = [
  { id: "aurora",     name: "Aurora",     vibe: "Calm indigo, the default",   font: "sans",  dark: false, bg: "oklch(0.98 0.005 262)", surface: "oklch(0.95 0.01 262)",  accent: "oklch(0.55 0.19 262)", fg: "oklch(0.25 0.02 262)" },
  { id: "paper",      name: "Paper",      vibe: "Warm cream, bookish serif",  font: "serif", dark: false, bg: "oklch(0.97 0.015 85)",  surface: "oklch(0.94 0.02 85)",   accent: "oklch(0.50 0.10 60)",  fg: "oklch(0.30 0.03 60)"  },
  { id: "forest",     name: "Forest",     vibe: "Deep greens, field-guide",   font: "sans",  dark: false, bg: "oklch(0.975 0.008 150)", surface: "oklch(0.94 0.015 150)", accent: "oklch(0.52 0.14 150)", fg: "oklch(0.27 0.03 150)" },
  { id: "sunset",     name: "Sunset",     vibe: "Amber warmth, friendly",     font: "sans",  dark: false, bg: "oklch(0.975 0.012 60)",  surface: "oklch(0.94 0.02 55)",   accent: "oklch(0.62 0.17 45)",  fg: "oklch(0.28 0.03 40)"  },
  { id: "mono",       name: "Mono",       vibe: "Ink on white, zero chroma",  font: "mono",  dark: false, bg: "oklch(0.98 0 0)",        surface: "oklch(0.94 0 0)",       accent: "oklch(0.30 0 0)",      fg: "oklch(0.22 0 0)"      },
  { id: "ocean",      name: "Ocean",      vibe: "Teal, technical calm",       font: "sans",  dark: false, bg: "oklch(0.975 0.008 210)", surface: "oklch(0.94 0.015 210)", accent: "oklch(0.55 0.12 210)", fg: "oklch(0.26 0.03 220)" },
  { id: "berry",      name: "Berry",      vibe: "Magenta pop, playful",       font: "sans",  dark: false, bg: "oklch(0.975 0.01 340)",  surface: "oklch(0.94 0.02 340)",  accent: "oklch(0.55 0.18 340)", fg: "oklch(0.27 0.03 340)" },
  { id: "slate",      name: "Slate",      vibe: "Steel blue, dark-first",     font: "sans",  dark: true,  bg: "oklch(0.27 0.02 250)",   surface: "oklch(0.31 0.02 250)",  accent: "oklch(0.72 0.12 250)", fg: "oklch(0.93 0.01 250)" },
  { id: "terracotta", name: "Terracotta", vibe: "Clay red, editorial",        font: "serif", dark: false, bg: "oklch(0.97 0.012 40)",   surface: "oklch(0.94 0.02 35)",   accent: "oklch(0.58 0.14 30)",  fg: "oklch(0.30 0.04 30)"  },
  { id: "mint",       name: "Mint",       vibe: "Fresh green-blue, light",    font: "sans",  dark: false, bg: "oklch(0.98 0.01 170)",   surface: "oklch(0.945 0.015 170)", accent: "oklch(0.60 0.12 170)", fg: "oklch(0.28 0.03 175)" },
  { id: "noir",       name: "Noir",       vibe: "Near-black, gold accents",   font: "mono",  dark: true,  bg: "oklch(0.20 0.005 270)",  surface: "oklch(0.24 0.008 270)", accent: "oklch(0.80 0.15 90)",  fg: "oklch(0.95 0 0)"      },
  { id: "sakura",     name: "Sakura",     vibe: "Soft pink, gentle serif",    font: "serif", dark: false, bg: "oklch(0.98 0.01 350)",   surface: "oklch(0.95 0.015 350)", accent: "oklch(0.65 0.15 355)", fg: "oklch(0.30 0.03 350)" },
];
```

**Mini site thumbnail** (used by pack cards in C and project cards in D): a small
rounded rect painted with the pack's `bg`, a header strip + heading line in `fg`,
an accent-colored button/link chip, 3–4 muted text lines, optionally a slim sidebar
column — all pure CSS driven by the pack's custom props. It should read as "a tiny
docs site in that theme" at a glance. `font` maps to `serif`→`Georgia, serif`,
`mono`→`var(--font-mono)`, `sans`→`var(--font-ui)` for the thumbnail heading only.

## Surface C — creation wizard / theme picker

The flow that creates a project. The real backend equivalent: fill a preset JSON
(name, themePack, colorScheme, defaultMode, features, headerItems) and execute it.

**Wizard content model (all variants draw from this):**

- **Name**: text field. Typed sample value: `Aurora Docs`. Derived slug shown live:
  `aurora-docs` (becomes the project URL, e.g. `aurora-docs.zudo.dev`).
- **Theme pack**: pick ONE of the 12 PACKS (Aurora preselected in mid-flow variants).
  Real product has 31 → show a "+19 more" affordance where the concept has room.
- **Color scheme**: accent-hue override row — `Default · Indigo · Teal · Amber ·
  Rose · Green` (Default selected). Plus **default mode**: segmented
  `Light · Dark · System` (System selected).
- **Features** (curated online subset, checkboxes w/ one-line descriptions):
  Search (on), Table of contents (on), Tag pages (on), Breadcrumbs (on),
  Prev/Next pager (on), Changelog page (off).
- **Header items** (advanced): GitHub link (URL field, empty), Version badge (off),
  Theme toggle (on, disabled "always on").
- **Create** primary button. Somewhere: a quiet "View preset JSON" affordance
  (link/collapsible; content may be a believable static JSON snippet) — nod to the
  real interchange format.

**Required behaviors (beyond the theme toggle):**

1. Clicking a theme pack marks it selected AND live-restyles whatever sample preview
   the concept shows (set the pack's custom props on the preview container). If the
   concept genuinely has no preview, the selection state alone is enough — say so in
   your return summary.
2. Typing in the Name field updates the derived slug text live (lowercase,
   spaces→`-`, strip non-alphanumerics).

## Surface D — dashboard / project library

The app home. **Project sample data (newest-first by updated):**

```js
const PROJECTS = [
  { id: "zfb-handbook",  name: "zfb Handbook",       pack: "slate",      pages: 28, drafts: 0, status: "published", publishedAgo: "5h ago",  updatedAgo: "5h ago" },
  { id: "aurora-docs",   name: "Aurora Docs",        pack: "aurora",     pages: 14, drafts: 2, status: "published", publishedAgo: "2d ago",  updatedAgo: "3h ago" },
  { id: "team-onboarding", name: "Team Onboarding",  pack: "paper",      pages: 9,  drafts: 1, status: "published", publishedAgo: "3w ago",  updatedAgo: "2d ago" },
  { id: "api-cookbook",  name: "API Cookbook",       pack: "ocean",      pages: 6,  drafts: 6, status: "never",     publishedAgo: null,      updatedAgo: "1w ago" },
  { id: "design-tokens", name: "Design Tokens Guide", pack: "berry",     pages: 17, drafts: 0, status: "published", publishedAgo: "1mo ago", updatedAgo: "1mo ago" },
  { id: "weekend-notes", name: "Weekend Notes",      pack: "mono",       pages: 3,  drafts: 3, status: "never",     publishedAgo: null,      updatedAgo: "4mo ago" },
];
```

Note `aurora-docs` is NOT first — "newest-first" is by `updatedAgo`, keep the array
order. (`zfb Handbook` updated 5h ago vs Aurora Docs 3h ago is deliberately close;
if your concept sorts, Aurora Docs may lead — either is fine, be consistent.)

**Required elements (arrange per concept):**

- Per project: name, theme-pack mini thumbnail (see §Theme packs), page count,
  draft count (subtle chip when > 0), publish status (`Published Xh/d ago` vs
  `Never published`), updated time, and an **Open** affordance (the whole card/row
  may be the affordance).
- **New project** affordance — prominent, concept decides the form (tile, button,
  omnibox result, …).
- **Duplicate / Delete** per project, with **inline delete-confirm**: render ONE
  project hard-coded in its confirm state ("Delete 'Weekend Notes'? This removes 3
  pages. [Delete] [Cancel]" — wording free, inline placement required, no browser
  `confirm()`).
- **Busy/recovery states**, sprinkled honestly: `design-tokens` mid-publish
  ("Publishing… " + small progress affordance), and ONE project showing a failed
  last publish ("Publish failed · Retry" — use `api-cookbook` or a concept-fitting
  spot). Subtle, chip-level; not modal drama.
- Slim app top bar (wordmark + TZ avatar) unless the concept is deliberately
  full-screen minimal.

**Required behaviors (beyond the theme toggle):**

1. A **search/filter field that actually filters** the visible projects (simple
   case-insensitive name match; empty state text when nothing matches).
2. The **New project affordance opens something** — a dialog/sheet/expanded state
   (a name field + a few theme swatches is plenty; it does NOT need to create
   anything). Close/cancel works.

## Deliverable per agent

ONE file at the exact path given in your brief. Return (per your output schema):
the file path, a 1-line concept summary, what interactive bits actually work, and
any deviations from this spec.
