# Eject contract (C0 — #2359)

Pinned design for the per-component `zudo-doc eject <component>` swizzle CLI (Epic
"Package-First Finale" #2356, implemented by C1 #2362). This is the **authoritative
contract**; the C1 implementer follows it mechanically. The full file:symbol-level
spec lives in the body of issue **#2362** — this note is the concise in-repo record.

## Problem

`@takazudo/zudo-doc` ships **`dist/` only** (`files: ["dist","bin","README.md"]` in
`packages/zudo-doc/package.json`) — consumers have no `src/`, and `dist/` is compiled
JS + `.d.ts`. Ejecting compiled JS into a TS project would drop a `.js` blob into a
strict-TS codebase: no types to edit comfortably, no JSX source, hostile to
customization. That is the trap flagged in epic review.

## The 5 pinned decisions

### 1. Ejectable source policy — **(a) ship an explicit ejectable TS source bundle**

The package publishes the **TS source** for the bounded ejectable set so a TS project
ejects TS, not compiled JS. Mechanism: add a curated `eject/` tree to the package
`files` allowlist (NOT the whole `src/` — that would publish ~200 internal modules and
double the tarball). At build time the package copies each ejectable component's source
directory verbatim from `src/<component>/` into `dist-eject/<component>/` (or `eject/`),
and that single dir is added to `files`. `bundle:false` already gives a 1:1
`src/<path>` → `dist/<path>` layout, so the source tree is the canonical shape; the
eject bundle is a straight copy of the source subtrees, `.tsx`/`.ts` preserved.

The `dist/` JS + `.d.ts` stays the runtime API surface for non-ejected imports; the
eject bundle is consumed **only** by the eject CLI's copy step, never imported at
runtime.

### 2. Ejectable component list — presentational/layout components only

Bounded to the visual components a user realistically restyles. Each entry is `<export
subpath>` → `<canonical local destination>` (destination is a directory; the whole
component dir is copied):

| Subpath | Source dir | Local destination |
|---|---|---|
| `@takazudo/zudo-doc/header` | `src/header/` | `src/components/zudo-doc/header/` |
| `@takazudo/zudo-doc/footer` | `src/footer/` | `src/components/zudo-doc/footer/` |
| `@takazudo/zudo-doc/breadcrumb` | `src/breadcrumb/` | `src/components/zudo-doc/breadcrumb/` |
| `@takazudo/zudo-doc/toc` | `src/toc/` | `src/components/zudo-doc/toc/` |
| `@takazudo/zudo-doc/sidebar` | `src/sidebar/` | `src/components/zudo-doc/sidebar/` |
| `@takazudo/zudo-doc/theme-toggle` | `src/theme-toggle/` | `src/components/zudo-doc/theme-toggle/` |
| `@takazudo/zudo-doc/page-loading` | `src/page-loading/` | `src/components/zudo-doc/page-loading/` |
| `@takazudo/zudo-doc/tab-item` | `src/tab-item/` | `src/components/zudo-doc/tab-item/` |
| `@takazudo/zudo-doc/doc-pager` | `src/doc-pager/` | `src/components/zudo-doc/doc-pager/` |
| `@takazudo/zudo-doc/content-admonition` | `src/content-admonition/` | `src/components/zudo-doc/content-admonition/` |
| `@takazudo/zudo-doc/code-group` | `src/code-group/` | `src/components/zudo-doc/code-group/` |
| `@takazudo/zudo-doc/details` | `src/details/` | `src/components/zudo-doc/details/` |

`<component>` CLI name = the subpath tail (`header`, `theme-toggle`, …). The
allowlist is a **single source map** in code (`EJECTABLE` in
`packages/create-zudo-doc/src/eject.ts`); anything not in it is rejected with the list
of valid names. Excluded by design: factories, pure utils, nav builders, plugins,
integrations, `*-with-defaults` host-wiring shells, type-only subpaths, `.css` assets.

### 3. `.zudo-doc.json` schema — provenance marker at project root

```jsonc
{
  "packageVersion": "0.2.22",          // @takazudo/zudo-doc version ejected source came from
  "ejected": {
    "theme-toggle": "src/components/zudo-doc/theme-toggle"  // <component>: <localDir, project-relative POSIX>
  }
}
```

- **Location:** `<projectRoot>/.zudo-doc.json`.
- **Superseded by the minimal-scaffold decision (epic zudolab/zudo-doc#2651
  #2653 Decision 6):** `scaffold.ts` no longer seeds this file — it is
  **lazy-created on first successful eject** instead.
  `packages/zudo-doc/src/eject/index.ts` tolerates its absence (defaults to
  `{ packageVersion: "unknown", ejected: {} }` in memory) and writes the real
  file, with the actually-installed package version, on the first `zudo-doc
  eject <component>` call. A freshly scaffolded project therefore has NO
  `.zudo-doc.json` until the user ejects something.

### 4. Import-rewiring strategy

Three import classes inside an ejected component:

1. **Same-directory relatives** (`./nav-active.js`, `./types.js`) — co-copied with the
   dir; **kept verbatim** (the sibling file moved with them).
2. **Parent-relative cross-component** (`../icons/index.js`, `../transitions/page-events.js`,
   `../smart-break/index.js`, `../code-syntax/index.js`, `../tab-item/index.js`) — these
   point at package dirs the user did NOT eject. **Rewrite** `../<dir>/index.js` →
   `@takazudo/zudo-doc/<dir>` (drop the `/index.js`, map `<dir>` to the published
   subpath). Verified cases: header→`../icons`,`../transitions`; breadcrumb→`../icons`;
   toc→`../smart-break`; page-loading→`../transitions`; doc-pager→`../icons`;
   code-group→`../code-syntax`,`../tab-item`. These resolve against the still-installed
   package and stay byte-correct.
3. **Consumer-side subpath import** (the call site referencing the now-ejected
   component, e.g. `import { ThemeToggle } from "@takazudo/zudo-doc/theme-toggle"` in
   `src/components/*.tsx` / `pages/lib/_*.tsx`) — **rewrite the specifier** from
   `@takazudo/zudo-doc/<component>` to a project-relative path to the local destination
   dir. C1 rewrites the specifier in any host file that imports the ejected subpath
   (scan + replace), or — minimum viable — documents/prints the rewrite for the user to
   apply. Exact scope (auto-rewrite all call sites vs. print instructions) is C1's call,
   but the local destination path in decision 2 is fixed.

**Idempotency:** re-ejecting an already-ejected component is a **safe no-op** — keyed
on the `.zudo-doc.json` `ejected[<component>]` entry. If present, the CLI prints
"already ejected at <path>" and exits 0 **without** re-copying (never clobbers local
edits) and **without** adding a duplicate provenance entry. Destination-dir existence is
the secondary guard.

### 5. CLI shape — **`zudo-doc` bin in `@takazudo/zudo-doc`** (revised S4 #2373)

> **Note (S4 #2373):** The initial C1 implementation placed the `zudo-doc` bin in
> `create-zudo-doc` (as originally specced). S4 relocated it into `@takazudo/zudo-doc`
> so generated projects (which depend on `@takazudo/zudo-doc`, not `create-zudo-doc`)
> have `node_modules/.bin/zudo-doc` available post-scaffold. The `EJECTABLE` map,
> `eject()` function, and `ZudoDocJson` type also moved to
> `packages/zudo-doc/src/eject/index.ts` (exported as `@takazudo/zudo-doc/eject`).

The bin is declared in `packages/zudo-doc/package.json`:

```jsonc
"bin": {
  "gen-z-index": "./bin/gen-z-index.mjs",
  "tags-audit": "./bin/tags-audit.mjs",
  "zudo-doc": "./bin/zudo-doc.mjs"
}
```

`bin/zudo-doc.mjs` (tsx-runner pattern, mirrors `bin/tags-audit.mjs`) spawns
`bin/zudo-doc-cli-runner.ts` via `tsx`. The runner imports `eject` and `EJECTABLE` from
`@takazudo/zudo-doc/eject` and parses `zudo-doc eject <component>` with `minimist`.
A separate bin keeps the scaffold entry (`create-zudo-doc`) single-purpose — the
framework-name binary owns ongoing project ops; `create-*` owns first-run scaffolding only.

## Why these calls

- **(a) ship TS source** — ejecting compiled JS into a strict-TS project is the
  explicit trap; a TS-native swizzle is the whole point. Curated `eject/` (not full
  `src/`) bounds the tarball cost.
- **Bounded list** — only presentational components are worth swizzling; ejecting a pure
  util or a factory would just fork logic with no styling payoff.
- **Rewrite parent-relatives to package subpaths** — the user ejects ONE component, not
  its whole dependency neighbourhood; cross-component deps must keep resolving against
  the installed package.
- **`.zudo-doc.json` + idempotent no-op** — provenance is the safety rail: it records
  what was forked and from which version (so a later migration skill / version-bump can
  reason about drift), and gates re-eject so a second `eject` never silently overwrites a
  user's customizations.
