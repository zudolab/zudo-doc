# zfb 4.3.2 adoption confirmation (#4543)

Baseline: main `f2cea6fd0820d34a7b98337854ccf35d66657e8d` (zfb 4.3.1), the commit
`base/zfb-432-adoption` was cut from. Candidate: `zfb-432-adoption/confirm` on top of
`5f324b27c` (zfb 4.3.2). Both were built locally in clean worktrees with the same
commands (`pnpm install --frozen-lockfile`, `pnpm build:workspace`, `pnpm build`).

## Local verification: green on both sides

| Check | Baseline (4.3.1) | Candidate (4.3.2) |
| --- | --- | --- |
| `pnpm build:workspace` | pass | pass |
| `pnpm build` | pass (809 pages) | pass (809 pages) |
| `zfb wind audit --fail-on error` | exit 0 | exit 0 |
| `pnpm check:package-wind-manifest` | pass (136 utilities) | pass (136 utilities) |
| `pnpm test` | not run | pass (root 63 files; packages 4/7/18/316 files) |

## Emitted CSS: byte-identical

All 31 emitted stylesheets (`dist/assets/styles-2f64c1b5.css` plus 30 theme-pack files)
have identical paths and SHA-256 digests on both sides. The hashed site stylesheet keeps
the same name, so no selector or declaration was added or removed.

That zero change is legitimate, not a missed fix. The audit report shows the upstream
effect:

- On 4.3.1, `zfb wind audit` listed `box`, `card`, `btn`, and `scroll-content` as
  unrecognized candidates, scanned from `<HtmlPreview html={...}>` in
  `src/content/docs{,-ja}/components/html-preview.mdx`, lines 90–216.
- On 4.3.2 those entries are gone, because `wind.sources.ignoreAttributes: ["html"]` now
  applies to them. Nothing else in the audit changed.
- Every leaked candidate was an ordinary (non-utility) class, so neither version emitted
  CSS for it.

All 19 classes found inside `html=` attributes across the 7 MDX files that use
HtmlPreview fall into three groups:

- `flex`, `grid`, `font-sans`, and `rounded-lg` are valid utilities that legitimately
  reach the CSS through the package Wind manifest.
- `bg-*-500`, `bg-slate-100`, `text-white`, and the numeric spacing classes are invalid
  in this token config (ZW006).
- `w-fit` (html-preview.mdx:395) is valid, but neither version scanned it, so neither
  emitted it.

## Strict A2: rebaselined from build identity only

PR #4544's run 38203324599 executed A2, which failed all three fingerprints. The causal
comparison shows only the `data-zfb-build` token moved. Evidence is in
[../4544-a2-rebaseline/](../4544-a2-rebaseline/README.md). Acceptance requires a fresh
A2 execution on the pushed head.

## Root Unit Tests: CI flake fixed

The same run failed `scripts/__tests__/select-a2-parity.test.ts` with
`ENOTEMPTY ... rmdir '/tmp/a2-selection-*/.git/objects/pack'`. The runner image
(ubuntu24 20261004.327, git 2.55.0) matches earlier green runs, which points to an
intermittent race: git detaches auto-maintenance after `commit` and writes a pack while
`afterEach` removes the directory. This is unrelated to the pin bump. The test now passes
`-c maintenance.auto=false -c gc.auto=0` to every git call.
