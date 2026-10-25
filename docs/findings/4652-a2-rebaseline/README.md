# 2026-10-26 A2 rebaseline for the diff-loader shadow (#4652)

PR #4654 adds the package-owned `@takazudo/zudo-doc/diff-loader` and, when
`docHistory` is off, shadows it with a throwing virtual module (mirroring the
#4651 katex-loader shadow). The A2 fixture runs with `docHistory` off, so the
doc-history island's lazy diff chunk changes. Strict hashes still include the
native build identity; no normalizer or approvedBaseline change is made.

## Captures

- **Baseline:** detached main `5dcddc84`, frozen install, `pnpm build:workspace`,
  then the package `A2 no-stub: injected routes render correct HTML` subset with
  `ZUDO_A2_CAPTURE_DIR` set. All 20 assertions passed.
- **Candidate:** `6e6434ca` (PR head), same subset and capture. Only the three
  strict fingerprints failed, with exactly the hashes from PR Checks run
  40233645592 (`afb32335…`, `06a17b3f…`, `9461b46e…`).

## Comparison

- **Lengths:** raw pages are 57,025, 67,457 and 78,909 bytes in both captures.
- **Normalized pages:** the only differing bytes are the `data-zfb-build`
  values (1, 2 and 4 occurrences), which move from `8cb8ae8c51978909` to
  `2de73b519748bf8b`. Substituting them back makes every normalized candidate
  page hash to the accepted reference.
- **Raw pages:** besides the build identity, only the islands entry script moves
  from `islands-a51711e7.js` to `islands-01be58e3.js`. Substituting both makes
  each raw candidate page byte-identical to the baseline.
- **Islands bundle (copied from the temporary fixture during each run):** three
  shared chunks are byte-identical. The baseline's 19,298-byte lazy chunk
  `islands-chunk-s6tsb687.js` (the bundled `diff` library) is replaced by the
  185-byte `islands-chunk-d8i2y7ic.js`, which only throws
  `diff is not bundled: docHistory is off, ...`. In the entry, with the chunk
  name substituted, the only other differences are the reworked
  `import(...).then(m => m.diffLines, () => null)` call from
  `doc-history/index.tsx` and the embedded build identity.

## Cause

The shadow plugin replaces doc-history's diff import target, which changes the
lazy chunk, the islands entry hash, and (through the linked package's source
digest) the native build identity. No visible markup, text or island props
changed.

## New strict hashes

- `404.html`: `afb3233510e880e7c943ef2c2713478e3ad38fcebdd86b34fe63142de761dcd1`
- `docs/getting-started/index.html`: `06a17b3f45b101e465304afa1e58a834fddbee44cd7c6c235a523d8547a87d01`
- `docs/getting-started/coverage/index.html`: `9461b46e72ede461ff0b78de0229649462d73a8e318e10d261d2d1dcd3d63dea`

This comparison explains the reference change; it does not certify the PR. A
fresh final-head PR run must still execute and pass A2.
