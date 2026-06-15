# zudo-doc z-index token adoption — implementation plan

Source strategy: `./zcss-z-index-strategy.mdx` (copied from `zudolab/zudo-css-wisdom`
`src/content/docs/methodology/design-systems/z-index-strategy.mdx`). Read it first —
this plan applies that strategy to zudo-doc. Epic: zudolab/zudo-doc#2148.

## What the strategy prescribes (summary)

1. **Semantic, single-namespace tokens** — names describe roles, never magnitudes
   (`--z-modal`, not `--z-60`). One flat ordered list.
2. **Codegen from a TypeScript source of truth** — a `z-index-tokens.ts` file is the
   single source; a `gen:z-index` script rewrites a `GENERATED:Z_INDEX` marker block in
   CSS; a `check:z-index` script re-runs codegen to a temp buffer and diffs (non-zero on
   drift) for pre-push/CI.
3. **Lint rule forbidding raw z-index integers** — block magic numbers; allow
   `var(...)`, `auto/inherit/initial`, and an escape-hatch comment.
4. **`--z-local-1/2/3`** for child promotion *inside* a parent stacking context
   (`isolation: isolate` etc.) — anonymous reusable helpers, not global tiers.
5. Anti-patterns to avoid: numeric token names (`--z-50`), `--z-emergency: 99999`,
   per-context namespaces, hand-editing the generated block.

## zudo-doc-specific wrinkle: Tailwind v4

zudo-doc styles via **Tailwind v4 utility classes** (`z-50`, `z-30`, ...), not raw
`z-index:` in component CSS. So the token system must wire through Tailwind's `@theme`
z-index namespace so that semantic utilities (`z-toolbar`, `z-modal`, ...) are generated.

- Tailwind v4 reads `@theme { --z-index-<name>: <n>; }` and generates a `z-<name>` utility.
- Raw CSS (e.g. the `<dialog>` rules, pseudo-elements in `global.css`) references the same
  var: `z-index: var(--z-index-<name>);`.
- The codegen therefore rewrites a `@theme`-scoped `GENERATED:Z_INDEX` marker block inside
  `src/styles/global.css`. The TS source stays the single source of truth; the styleguide
  (if/when added) imports it directly.
- **Verify** the generated utilities actually resolve (a quick build + grep of `dist/`
  for the class) — the exact `@theme` encoding (`--z-index-*` namespace) is the one detail
  the generic strategy doc does not cover.

## Tier list (the single source of truth contents)

Single namespace. Canonical names from the strategy where they apply, plus two
zudo-doc-specific tiers (`sidebar`, `drag`) added via the strategy's "add a new tier"
path with documented purpose. Values are deliberately gapped but otherwise arbitrary
(renaming/reordering is cheap — that's the whole point).

| token (`--z-index-*` / utility `z-*`) | value | kind | purpose / who uses it |
|---|---|---|---|
| `content`          | 0  | global | default in-flow content (implicit baseline) |
| `local-1`          | 1  | local  | child promotion inside an isolated parent |
| `local-2`          | 2  | local  | child promotion inside an isolated parent |
| `local-3`          | 3  | local  | child promotion inside an isolated parent |
| `sidebar`          | 10 | global | persistent layout chrome: desktop sidebar, TOC, sidebar-toggle handle, resizer handle |
| `toolbar`          | 20 | global | sticky top header (strategy's "toolbar/header" tier; sits above sidebar chrome) |
| `dropdown`         | 30 | global | header menus, version/language switchers |
| `popover`          | 40 | global | reserved — inline popovers (canonical scale; not yet used) |
| `modal-backdrop`   | 50 | global | mobile drawer backdrop, `<dialog>` `::backdrop` |
| `modal`            | 60 | global | mobile sidebar drawer panel, search `<dialog>` |
| `toast`            | 70 | global | reserved — transient notifications (canonical scale; not yet used) |
| `tooltip`          | 80 | global | reserved — highest steady UI layer (canonical scale; not yet used) |
| `drag`             | 90 | global | transient drag affordance: sidebar-resizer ghost line (replaces the `z-9999` anti-pattern) |

> Rationale notes to embed as comments in `z-index-tokens.ts`:
> - `sidebar` and `drag` are zudo-doc additions — the strategy's overlay-centric scale has
>   no persistent-sidebar/TOC tier nor a drag-affordance tier. Header is given a tier
>   ABOVE sidebar to preserve the existing header-wins ordering (they don't overlap
>   spatially, but keep the historical relationship explicit).
> - `popover`/`toast`/`tooltip` are reserved canonical tiers kept for completeness and so
>   downstream `create-zudo-doc` users inherit the full scale.

## Migration mapping (current → token)

### Host app `src/`

- `components/sidebar-tree.tsx:508` `z-10` (tree connector line) → `z-local-1`
- `components/site-tree-nav.tsx:121` `z-10` (dashed connector line) → `z-local-1`
- `components/sidebar-toggle.tsx:129` `z-30` (mobile drawer backdrop) → `z-modal-backdrop`
- `components/sidebar-toggle.tsx:144` `z-40` (mobile drawer panel) → `z-modal`
- `components/desktop-sidebar-toggle.tsx:105` `z-40` (floating toggle handle) → `z-sidebar`
- `styles/global.css` raw `z-index: 1 / 0` at lines ~696, 1166, 1175, 1180, 1215, 1228,
  1233 (component pseudo-elements / local layering) → `var(--z-index-local-1)` /
  `var(--z-index-local-2)` — inspect each; these are local promotions inside their own
  components, so `local-N`. Keep relative order within each component.
- `styles/global.css:1398` `.page-loading-overlay { z-index: 9999 }` → `var(--z-index-modal)`
  (it is a full-screen blocking overlay = modal tier; NOT `drag`).

### Package `packages/zudo-doc/src/`

- `header/header.tsx:258` `z-50` (sticky header) → `z-toolbar`
- `header/header.tsx:327` `z-10` (header dropdown menu) → `z-dropdown`
- `header/header.tsx:422` `z-50` (header hover dropdown) → `z-dropdown`
- `i18n-version/version-switcher.tsx:216` `z-10` (switcher menu) → `z-dropdown`
- `doclayout/doc-layout.tsx:282` `z-30` (desktop sidebar) → `z-sidebar`
- `doclayout/doc-layout-with-defaults.tsx:367` `z-50` (sticky header variant) → `z-toolbar`
- `toc/toc.tsx:76` `z-10` (sticky TOC) → `z-sidebar`
- `sidebar-resizer/index.ts:126` `zIndex:"10"` (handle) → `var(--z-index-sidebar)`
- `sidebar-resizer/index.ts:212` `zIndex:"9999"` (drag ghost) → `var(--z-index-drag)`
- `sidebar-resizer/sidebar-resizer-init.tsx:85` `zIndex:"10"` (handle) → `var(--z-index-sidebar)`
- `sidebar-resizer/sidebar-resizer-init.tsx:120` `zIndex:"9999"` (drag ghost) → `var(--z-index-drag)`

> Inline `Object.assign(el.style, { zIndex: ... })` cases read the CSS var via
> `getComputedStyle`/`var()` — simplest is to set `zIndex: "var(--z-index-sidebar)"` if the
> element is in the document (custom props cascade to it), or read the resolved value once.
> The agent verifies the resizer still layers correctly (handle below ghost during drag).

### Search dialog (handled in sub-issue B, not A2)

- `pages/lib/_search-widget.tsx` / `_search-widget-script.ts`: dialog gets `z-modal`,
  its `::backdrop` gets `--z-index-modal-backdrop`, plus the close-on-result-click fix.

### Template mirrors (create-zudo-doc) — keep in lock-step

- `packages/create-zudo-doc/templates/base/src/components/{sidebar-tree,sidebar-toggle,site-tree-nav,desktop-sidebar-toggle}.tsx`
- `packages/create-zudo-doc/templates/base/src/styles/global.css`
- `packages/create-zudo-doc/templates/features/sidebarToggle/files/src/components/desktop-sidebar-toggle.tsx`
- `packages/create-zudo-doc/templates/features/tauri/files/src/components/find-bar.tsx` (`z-50` → `z-toolbar`)
- The token file, codegen scripts, `package.json` scripts, and `.design-token-lint.json`
  must be mirrored into the template too (Feature Change Checklist + `check:template-drift`).

## Sub-issue breakdown (4 issues, 3 waves)

**Wave 1 — foundation**

- **A1: token source of truth + codegen + drift check + `@theme` block.**
  Create `z-index-tokens.ts`, `scripts/gen-z-index.mjs` (+ `--check` mode or a sibling
  `check-z-index`), add `gen:z-index` / `check:z-index` to `package.json`, insert the
  `GENERATED:Z_INDEX` `@theme` marker block in `src/styles/global.css`, wire `check:z-index`
  into `b4push` and the `b4push-ci-parity` guard (+ CI), and mirror all of it into the
  `create-zudo-doc` template. No behavior change yet (tokens defined, nothing migrated).

**Wave 2 — migration + dialog (parallel; both depend on A1)**

- **A2: migrate every existing z-index usage onto tokens** per the mapping table above
  (host + package + template mirrors). Excludes the search dialog. Verify visual stacking
  unchanged (header > sidebar > content; dropdowns above header; mobile drawer above all
  chrome; resizer ghost on top during drag).
- **B: search dialog fix** (the original task) — close-on-result-click under
  `zfb:after-swap`, harden the `<dialog>` with `z-modal` + `::backdrop`
  `--z-index-modal-backdrop`, template mirror, and an E2E spec (spec-naming-guard
  compliant). Disjoint files from A2, so runs in parallel.

**Wave 3 — enforcement (depends on A2 + B)**

- **A3: add the raw-z-index lint pass** — extend `.design-token-lint.json` `prohibited`
  with the numeric Tailwind `z-{n}` utilities (and document the escape hatch); run
  `pnpm lint:tokens` → must be clean (proves A2 + B migrated everything). Mirror the config
  into the template. Update the b4push token-lint note if needed.

## Definition of done

- `pnpm gen:z-index` regenerates the block idempotently; `pnpm check:z-index` is clean.
- `pnpm lint:tokens` rejects new `z-{n}` and passes on the migrated tree.
- `pnpm check:template-drift` + `pnpm check:fixture-settings-drift` pass (template mirrored).
- `pnpm b4push` green; the search-dialog E2E passes in CI.
- No raw `z-index:` integer or numeric `z-{n}` utility remains outside the escape hatch.

## Review addenda (incorporated from Step-5 plan review)

These corrections are authoritative and override anything above that conflicts. The
wave structure is unchanged; only scope details tightened.

**A1 (foundation):**

- **b4push ⇄ CI parity (do NOT skip a touch-point).** `check:z-index` must be wired in
  THREE places or `pnpm check:b4push-ci-parity` fails:
  1. `scripts/run-b4push.sh` — add the step **inside** the
     `# >>> b4push-ci-parity:guards` / `# <<< b4push-ci-parity:guards` marker region
     (a step added after the close marker escapes the scan), and bump `TOTAL_STEPS`.
  2. `scripts/check-b4push-ci-parity.mjs` — add a `REQUIRED_CI_GUARDS` entry with its
     `ciNeedle` + `b4pushScript`.
  3. `.github/workflows/pr-checks.yml` — add the matching CI job/step.
- **Tailwind v4 namespace (confirmed):** the `z` utility reads the `--z-index` theme key,
  so `@theme { --z-index-toolbar: 20 }` generates `.z-toolbar { z-index: 20 }`. The
  `--z-index-*` namespace is independent of the existing `--color-*: initial` reset at
  `global.css:96` — do NOT add a `--z-index-*: initial` reset; it isn't needed.

**A2 (migration) — additions/corrections:**

- **MISSED usage — add it:** `src/styles/global.css:696` `.code-buttons { z-index: 1 }`
  → `var(--z-index-local-1)`. `.code-block-wrapper` (its stacking parent) already has
  `position: relative` at ~666. (Plus the template mirror `templates/base/src/styles/global.css:699`.)
- Drop the `~` from line numbers — these exact lines are accurate now: global.css 696,
  1166, 1175, 1180, 1215, 1228, 1233, 1398.
- **Deliberate behavioral change (call out, don't "fix"):** desktop sidebar drops 30→`z-sidebar`(10)
  and mobile drawer backdrop goes 30→`z-modal-backdrop`(50). Previously backdrop and desktop
  sidebar shared z=30 (paint-order dependent); now the backdrop is definitively above the
  sidebar (50 > 10). This is intended and harmless.
- `header.tsx:422` dropdown is a child of the sticky header's stacking context, so its
  own z-index is inoperative (it escapes visually via `top-full`, not z-order). Migrate to
  `z-dropdown` for consistency anyway; do not try to "make it work" — no behavior change.
- `find-bar.tsx` is **template-only** (Tauri feature); there is no host-side counterpart —
  the template edit is the whole story for that file.
- **Definition of done additions:** after migrating `packages/zudo-doc/src/**`, run
  `pnpm build` (or the package's `tsup` build) so `gen-safelist.mjs` regenerates
  `packages/zudo-doc/dist/safelist.css`; verify it now contains the new semantic `z-*`
  classes (and no stale `z-10/z-30/z-50` from removed code), and that
  `pnpm check:package-safelist` passes. (`gen-safelist.test.ts` tests the extractor logic,
  not the literal class set — it stays green; don't be thrown by its `z-50` fixtures.)
- Confirm no third-party CSS (zdtp panel, Mermaid) sets a z-index above the new `modal`(60)
  that would be newly exposed by lowering `page-loading-overlay` 9999→`modal`(60).

**B (search dialog) — scope clarification:**

- The `<dialog>` currently has **no** explicit z-index and relies on native `showModal()`
  top-layer promotion. The real fix is **close-on-result-click** under `zfb:after-swap`.
  The `z-modal` + `::backdrop` `--z-index-modal-backdrop` hardening is **defense-in-depth**
  for the SPA-swap window where the dialog can momentarily lose top-layer promotion and
  flash behind the header — it is intentionally redundant in the normal case, not a no-op.
  State this in the issue so the implementer doesn't "simplify" it away.

**A3 (lint) — scope decision (pick this one):**

- The current `@takazudo/zudo-design-token-lint` config only scans `*.{tsx,jsx}`
  (`patterns` field). A3's PRIMARY pass is therefore the **Tailwind class** prohibition:
  add the numeric `z-{n}` utilities to `prohibited`, with `z-auto` allowed and the
  documented escape-hatch comment. **CSS-file raw `z-index:` integers are NOT linted by
  this tool** — they are instead guarded structurally by `check:z-index` (the codegen
  drift check) since every CSS z-index now flows through the generated `@theme` block.
  Do not attempt to extend the linter to `.css` files; rely on `check:z-index` for that
  surface and say so in the issue.
