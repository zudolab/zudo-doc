# Scaffold-first customization audit — findings, doc-improvement plan, session handoff

**Date:** 2026-07-13
**Branch:** `claude/doc-scaffold-customization-v8fcsa`
**Status:** Investigation complete; plan drafted; implementation NOT started (session ended early on rate-limit budget — see Handoff at the bottom).

## Why this exists

The project pivoted to **scaffold-first**: `create-zudo-doc` emits a ~12-file
minimal project and everything else ships from `@takazudo/zudo-doc` in
`node_modules`. The question this session answered: **do our showcase docs
teach a scaffolded-project user how to customize — especially "how do I add my
own components?" — and is what they say accurate for the minimal-scaffold
shape?**

Method: actually scaffolded a fresh project (default `-y` choices, built from
`create-zudo-doc@3.3.0` on this repo's current source, deps from npm), then
hands-on tested every customization path against real builds; in parallel, a
6-dimension × adversarially-verified doc audit swept `src/content/docs/`.

**Answer: the customization surface is real and mostly works, but it is
essentially undocumented — and several documented paths are stale
(pre-package-first) or actively broken in a fresh scaffold.**

---

## Part 1 — Hands-on verified findings (each proven against a real scaffold build)

### F1 — `chromeBindingsModule` never reaches doc pages in a fresh scaffold (product bug + doc bug)

The scaffold's `pages/docs/[[...slug]].tsx` stub **shadows** the
package-injected `/docs/[[...slug]]` route (build log: "shadowed by a user
pages/ route (user wins); skipping") and calls `createChrome(routeCtx)` with
**no** hostBindings argument. `createChrome` defaults `hostBindings = {}`; the
`virtual:zudo-doc-chrome-bindings` module is only consumed by the package's
`routes/_chrome.tsx` — which the stub shadows. Result: setting
`chromeBindingsModule` in a fresh scaffold silently does **nothing** for doc
pages (`mdxExtras` → "MDX requires `MyBadge` to be passed via the `components`
prop" 500; every other slot stays at its stub default).

The **showcase's own stub** (`pages/docs/[[...slug]].tsx` here) imports
`virtual:zudo-doc-chrome-bindings` and passes it as the second arg — the
generated template stub (`packages/create-zudo-doc/templates/base/pages/docs/[[...slug]].tsx`)
does not. This is template drift.

**Verified workaround (documented recipe until the template is fixed):** edit
the stub to statically import the bindings module and pass it:

```tsx
import { chromeBindings } from "../../src/chrome-bindings";
const { renderDocPage } = createChrome(routeCtx, chromeBindings);
```

(The showcase-style `import { chromeBindings } from "virtual:zudo-doc-chrome-bindings"`
also works and keeps the config-driven indirection; the static import
additionally guarantees island-scanner reachability — see F4.)

**Fix candidates:** (a) patch the template stub to mirror the showcase (import
the virtual module unconditionally — safe: the plugin emits
`export const chromeBindings = {}` when the setting is absent); (b) same for the
`i18n` feature's `[locale]` stub variant; (c) doc updates in
`host-chrome-bindings.mdx` + `customizing.mdx` rung 5 (their examples do not
work verbatim on a fresh scaffold today).

### F2 — `mdxExtras` is THE seam for "add your own MDX component" — and it appears in zero docs

`defineChromeBindings({ mdxExtras: { MyBadge } })` +
`chromeBindingsModule: "./src/chrome-bindings.tsx"` (+ the F1 stub threading)
makes `<MyBadge label="..." />` usable in every `.mdx` file, and same-named
keys **override package defaults** (spread last in
`packages/zudo-doc/src/mdx-components/index.ts` — so it's also the only way to
replace `Details`, `HtmlPreview`, admonitions, or wire an ejected content
component back in). `grep -r mdxExtras src/content/docs` → **no matches**.
`host-chrome-bindings.mdx`'s own slot table omits it (along with
`BodyEndIslands`, `DocHistory`, `DesignTokenPanelBootstrap`).

### F3 — ESM imports inside MDX **work** (contrary to what part of the audit assumed)

`import { MyBadge } from "@/components/my-badge";` inside an `.mdx` file
builds and renders fine, including the `@/` alias (verified: the import line is
consumed, the component renders). So `writing-docs.mdx`'s per-file import
recipe is *accurate* — but it is demonstrated nowhere in the codebase, doesn't
cover global registration (mdxExtras), and a bare import cannot hydrate
(see F4). Docs should present **both** paths with their trade-offs.

### F4 — A user's own hydrating island in MDX content works end-to-end — via an entirely undocumented recipe — but naming is fragile

Verified working recipe in a fresh scaffold:

1. `"use client"` component in `src/components/counter.tsx` (`useState` etc.);
2. wrap it: `const CounterIsland = () => Island({ when: "visible", children: <Counter /> })`
   with `import { Island } from "@takazudo/zfb"`;
3. register `Counter: CounterIsland` in `mdxExtras`;
4. thread bindings **statically** into the doc stub (F1) — the virtual channel
   is explicitly not hydration-safe (the SSR-presentational warning in
   `host-chrome-bindings.mdx` is correct).

Result: `data-zfb-island=Counter` marker in SSG HTML + Counter code in the
islands bundle. **No doc anywhere teaches this** (the audit's islands dimension
confirmed: gap, `MISSING`).

⚠️ **Fragility found (zfb bug candidate):** after adding an unrelated MDX page
that imported another component, the island marker was emitted as `Counter2`
(bundler identifier dedup) while the registry kept `Counter` → hydration broke,
with a loud build warning. Island marker naming is derived from the compiled
identifier, not a stable key. Worth an upstream zfb issue before documenting
the recipe as robust.

### F5 — `zudo-doc eject` of chrome components is a **no-op** in a fresh scaffold (rung 4 is misleading)

`pnpm exec zudo-doc eject theme-toggle` copies source to
`src/components/zudo-doc/theme-toggle/` and writes `.zudo-doc.json`, but
reports "**No host call sites found**". Verified: editing the ejected copy
(aria-label probe) and rebuilding → **change never reaches the output**; the
package chrome still renders its internal copy. In a minimal scaffold this
applies to every chrome-rendered component (header, footer, sidebar, toc,
breadcrumb, theme-toggle, doc-pager, the sidebar islands, …):

- `HeaderRightComponentName` is a **closed enum** (`theme-toggle` |
  `language-switcher` | `version-switcher` | `github-link` | `search`) — no
  custom-component slot;
- `ChromeHostBindings` has **no Header/Footer/Sidebar/Toc slot**;
- so there is currently **no supported path to customize chrome markup** in a
  fresh scaffold short of forking the whole route stub + hand-composing chrome.

Eject IS meaningful for **content-layer** components the user references
through `mdxExtras` (details, code-group, content-admonition, tab-item, …) —
the ejected copy gets used because the *user's* binding imports it.
`customizing.mdx` rung 4 ("changes take effect immediately") and
`sidebar-filter.mdx` ("eject the sidebar-tree-island and modify the filter
logic") are wrong/broken escalation paths as written.

**Fix candidates:** (a) eject CLI should warn loudly for chrome-rendered
components ("copy created but nothing references it — this component is
package-chrome-wired"); (b) longer-term: chrome-bindings slots for chrome
components (or an ejected-component override map); (c) docs: rewrite rung 4
with the real constraint + the content-component recipe.

### F6 — The Tailwind utility vocabulary available to scaffold users is undocumented (and surprising)

Scanning **works everywhere** (probed with unique arbitrary values: MDX
content, `src/components/`, `src/chrome-bindings.tsx`, `pages/` — all
generated; the `@source` globs plus auto-detection cover the project tree).
But the **default Tailwind theme is deliberately absent** (`tailwindcss/theme`
is never imported; the package `theme.css` is the vocabulary). Verified matrix
in a fresh scaffold, writing classes in MDX:

| Works | Dead (silently unstyled) |
| --- | --- |
| project tokens: `text-caption`, `bg-accent`, `px-hsp-*`, `py-vsp-*`, `w-icon-*`, `z-*` tiers | numeric spacing: `p-4`, `mt-8`, `w-64` |
| `tracking-tight/normal/wide/wider` (in theme.css) | `tracking-tighter`, `tracking-widest` |
| `rounded`, `rounded-lg` (radius tokens exist) | default type scale: `text-sm`, `text-lg` |
| static utilities: `flex`, `grid-cols-3`, `hidden`, … | default palette: `bg-blue-500` (reset by design) |
| arbitrary values: `m-[13.37px]`, `w-[42%]` — full escape hatch | `shadow-md` (only project shadow tokens exist) |

No doc tells a scaffold user this. The design-system pages describe the
three-tier token strategy for *showcase contributors*, not "what can I type in
my MDX and have it work". Classes render into HTML either way — failure mode is
silent unstyled markup.

### F7 — `class=` fails `pnpm check` in user `.tsx` files — use `className`

The scaffold tsconfig maps `react` → `preact/compat`, so JSX in *user* files
typechecks against React-flavored typings: `class=` → TS2322
(verified; `className` passes). Package/showcase source uses `class=` — copying
those snippets into a scaffold `.tsx` file breaks `zfb check`. Any
"write your own component" doc must standardize on `className` (works in both).

### F8 — Token overrides (rung 3) verified working

`--color-accent: oklch(...)` in the scaffold `global.css` `@theme` block →
reaches the built CSS. The documented story is accurate.

### F9 — Custom directives work, but the documented recipe is stale

Working recipe (verified): `directives: { ...defaultDirectiveVocabulary,
callout: "Callout" }` in `zudoDoc({})` (import from
`@takazudo/zudo-doc/directive-vocabulary-defaults` — the field **replaces** the
map wholesale; forgetting the spread kills all admonitions) + `Callout`
registered via `mdxExtras` (F2). The current doc
(`markdown-features/directives-registry.mdx`) instead points at
`pages/_mdx-components.ts` — a file that hasn't existed since the
package-first migration.

---

## Part 2 — Doc-audit findings (adversarially verified sweep)

A 6-dimension audit (own-MDX-components / chrome-bindings slots /
styling-theming / eject+pages / onboarding accuracy / islands) with per-finding
adversarial verification ran over `src/content/docs/`. 30 of 32 verifications
completed before the session wrapped; findings below de-duplicated. The
`pages/_mdx-components.ts` staleness family traces to the same root cause
(package-first migration docs debt).

**Stale — instruct editing files that no longer exist (fresh scaffold AND showcase):**

- `markdown-features/directives-registry.mdx` — `pages/_mdx-components.ts` recipe (see F9)
- `markdown-features/github-alerts.mdx` — register Important/Caution in `pages/_mdx-components.ts`; hazard itself is gone (package registers them)
- `markdown-features/code-tabs.mdx` — "registers CodeGroup in `pages/_mdx-components.ts`"
- `components/image-enlarge.mdx` — attributes the `p` override to `pages/_mdx-components.ts`
- `guides/development-workflow.mdx` — content-typography "live in `src/components/content/`" + islands inventory of deleted host files
- `reference/frontmatter-preview.mdx` — "open `src/config/frontmatter-preview-renderers.tsx`" (scaffold has no `src/config/`); the real channel is the `frontmatterRenderers` bindings slot
- `guides/sidebar.mdx` — "write `src/config/sidebars.ts`" as if auto-consumed; real channel is the `sidebarsConfig` bindings slot
- `getting-started/installation.mdx` — "edit ramps in `src/config/color-schemes.ts`" (deleted even from the showcase; package-owned now); `.npmrc` annotation wrong (`engine-strict` vs actual trust-policy line); features table lists 4 of 24 toggles
- `reference/design-system.mdx` — global.css called "single source of truth" (tokens ship from package `theme.css`; scaffold block is empty); spacing tables outdated (hsp-2xs, whole vsp scale, missing vsp-3xs)
- `reference/color.mdx` — Tier-2 "defined in global.css" (package-owned); `pnpm contrast:audit` + a11y skill referenced but showcase-only; `colorScheme` example inert while `colorMode` (default ON) wins
- `reference/component-first.mdx` — `.zd-content` typography location; island registration mechanism described via deleted host files
- `reference/design-token-panel.mdx` — tokens "configured in global.css" (override point only)
- `packages/create-zudo-doc/docs/eject-contract.md` — 12 vs actual 18 components; wrong EJECTABLE map location

**Misleading — config toggles that silently do nothing on a fresh scaffold** (all downstream of F1's severed bindings channel + no-op slot defaults):

- `guides/doc-history.mdx` — `docHistory: true` alone never shows the History button (DocHistory slot default is a no-op stub; needs the bindings threading — the generator only patches the stub when the feature was selected at scaffold time)
- `guides/configuration.mdx` — `docMetainfo` implies flipping shows Created/Updated (reads `docHistoryMeta` slot, default `{}`)
- `guides/footer-taglist.mdx` — taglist renders empty without `loadTagsForLocale`/`tagVocabulary` bindings
- `reference/frontmatter-preview.mdx` — "appears automatically" (entry builder defaults to `() => []`)
- `reference/host-chrome-bindings.mdx` — "/ route topology" section describes a host `pages/index.tsx` adapter with `extras` prop; scaffold's index is a 1-line re-export with no such prop
- `reference/customizing.mdx` rung 5 + `host-chrome-bindings.mdx` overall — examples don't work verbatim on a fresh scaffold (F1)
- `reference/customizing.mdx` rung 4 — eject "changes take effect immediately" (F5); un-eject instruction leaves broken rewritten imports unmentioned
- `reference/customizing.mdx` rung 6 — stubs framed as ordinary shadowing pages; `pages/index.tsx` shadows nothing (`/` is never injected), doc stub is load-bearing for dev
- `guides/sidebar-filter.mdx` — "eject sidebar-tree-island and modify" is a broken escalation path (F5)
- `getting-started/writing-docs.mdx` — i18n section presents `docs-ja/` as always present (scaffold defaults i18n OFF)

**Gaps — seams that exist in code with zero doc coverage:**

- `mdxExtras` (F2) — the #1 ask: "how do I add my own component?"
- The end-to-end island recipe (F4)
- The Tailwind vocabulary for scaffold users (F6) — incl. how `@source` globs
  cover `src/components/**` but NOT e.g. `src/chrome-bindings.tsx` or `src/ui/`
  (arbitrary locations rely on auto-detection; utilities can silently drop)
- `SearchWidget` slot (7-prop contract) — replaceable header search, undocumented in `guides/search.mdx`
- `BodyEndIslands`, `DocHistory`, `DesignTokenPanelBootstrap` slots — absent from `host-chrome-bindings.mdx`
- `develop/routing-conventions.mdx` — cited twice as the reference for package-route injection/shadowing but covers only generic `paths()` conventions
- `guides/configuration.mdx` `directives` entry — doesn't warn the override replaces the canonical seven wholesale, nor show the spread pattern
- `reference/create-zudo-doc.mdx` — missing `--[no-]noindex`, `--[no-]git` flags

---

## Part 3 — Doc-improvement plan (proposed work, priority order)

Every content change is bilingual (EN + JA mirror) per `src/content/CLAUDE.md`.

### Wave A — the "add your own component" story (highest value, unblocks the pivot's promise)

1. **New page: `guides/custom-components.mdx`** (or `reference/`): the
   canonical "Add your own components" guide —
   (a) per-file MDX import (works today, F3);
   (b) global registration via `mdxExtras` + `chromeBindingsModule` + the stub
   threading caveat (F1/F2), with a complete copy-pasteable example
   (`src/chrome-bindings.tsx` + config + stub edit);
   (c) overriding package MDX components (Details/HtmlPreview/admonitions) via
   same-named `mdxExtras` keys;
   (d) `className` not `class` in user `.tsx` (F7);
   (e) interactive islands: the F4 recipe, flagged experimental until the
   marker-naming fragility is resolved upstream.
2. **`reference/host-chrome-bindings.mdx`**: add the 4 missing slots
   (`mdxExtras`, `BodyEndIslands`, `DocHistory`, `DesignTokenPanelBootstrap`);
   fix the "/ route topology" section for the scaffold's actual `index.tsx`;
   add a prominent "fresh-scaffold caveat" box describing the stub-shadowing
   reality (F1) until the template fix ships.
3. **`reference/customizing.mdx`**: insert the new guide into the ladder;
   correct rungs 4/5/6 per F5/F1/audit.
4. **`markdown-features/directives-registry.mdx`**: rewrite the custom-directive
   recipe (F9); sweep the other `pages/_mdx-components.ts` references
   (`github-alerts.mdx`, `code-tabs.mdx`, `components/image-enlarge.mdx`).

### Wave B — "config toggles that do nothing" honesty pass

5. `guides/doc-history.mdx`, `guides/configuration.mdx` (`docMetainfo`,
   `directives`), `guides/footer-taglist.mdx`,
   `reference/frontmatter-preview.mdx`, `guides/sidebar.mdx` — each gets the
   real recipe (bindings slot + threading) instead of the bare toggle, with a
   shared "requires chrome bindings" admonition pattern.

### Wave C — styling truth for scaffold users

6. **New section or page: "What Tailwind vocabulary you have"** (likely inside
   `reference/design-system.mdx` or the new custom-components guide): the F6
   works/dead matrix, arbitrary-value escape hatch, `@source` coverage rules,
   and "how to re-enable default theme pieces" (import `tailwindcss/theme` or
   define tokens in the `@theme` block).
7. Fix stale token-location claims across `design-system.mdx`, `color.mdx`,
   `component-first.mdx`, `design-token-panel.mdx`; refresh the spacing tables;
   fix the `colorScheme` vs `colorMode` example; drop/replace showcase-only
   `contrast:audit` guidance.

### Wave D — onboarding + reference accuracy

8. `getting-started/installation.mdx`: project-structure annotations
   (`.npmrc`), full feature list (24 toggles), remove `src/config/color-schemes.ts`;
   `writing-docs.mdx`: i18n conditional on the feature; add pointer to the new
   custom-components guide.
9. `reference/create-zudo-doc.mdx`: missing flags.
10. `develop/routing-conventions.mdx`: add the package-route
    injection/shadowing model (or retarget the two inbound links).
11. `guides/development-workflow.mdx` + `reference/component-first.mdx`:
    rewrite the component-development sections for the package-first shape.
12. `packages/create-zudo-doc/docs/eject-contract.md`: sync to implementation
    (18 components, real map location).

### Companion product fixes (separate issues, not docs — file first, docs reference them)

- **P1: template stub should thread `virtual:zudo-doc-chrome-bindings`**
  (mirror the showcase stub) — fixes F1 for every new scaffold; also the
  `[locale]` i18n stub variant. Follow the Feature Change Checklist +
  template-drift check.
- **P2: eject CLI loud warning** (or docs-only stopgap) for chrome-rendered
  components with no host call sites (F5).
- **P3 (upstream zfb): island marker identifier-dedup fragility** (F4,
  `Counter` → `Counter2` breaks hydration after unrelated changes).
- **P4 (design discussion): chrome customization seam** — closed
  `HeaderRightComponentName` enum + no Header/Footer bindings slots means no
  supported chrome-markup customization in a fresh scaffold; decide the
  intended story before documenting one.

---

## Part 4 — Handoff for the next session

- **Branch:** work stays on `claude/doc-scaffold-customization-v8fcsa`. This
  document is the only commit so far; no doc content has been changed yet.
- **State of evidence:** every Part-1 finding was verified against a real
  scaffold build this session (scaffold lived in the session scratchpad — gone
  with the container; recipes above are complete enough to reproduce:
  `node packages/create-zudo-doc/bin/create-zudo-doc.js my-docs -y --pm pnpm --no-install`,
  then `pnpm install && pnpm build` inside it).
- **Audit completeness:** the background audit finished 30/32 adversarial
  verifications; Part 2 reflects finder output cross-checked against Part 1's
  hands-on results where they overlap. One finder claim ("zfb MDX doesn't
  evaluate ESM imports") was **refuted** hands-on (F3) — trust Part 1 over
  Part 2 on any conflict.
- **Suggested next steps:** (1) file the P1–P4 product issues; (2) run
  `/big-plan` over Part 3 to break the waves into child issues (Wave A first —
  it's the pivot's core promise), or implement Wave A directly; (3) remember
  the bilingual rule and `pnpm check:template-drift` if the template stub (P1)
  changes; (4) re-verify F1's workaround against whatever `@takazudo/zudo-doc`
  version is current when implementing — the scaffold pulls published packages,
  so fixes land for users only after a release + `create-zudo-doc` pin bump.
