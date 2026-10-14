# 2026-10-13 A2 rebaseline for patched KaTeX (#4572)

The linked package's dependency, CSS, tests and documentation change its native
build identity. Strict hashes still include that identity; no normalizer or
approvedBaseline change is made.

Baseline: detached main `657bf97f6eda70382a715bb5940e0afc169f2205`, frozen install,
workspace build, then the guarded package `A2 no-stub: injected routes render correct HTML`
subset with `ZUDO_A2_CAPTURE_DIR=/tmp/a2-baseline-local`: all 20 assertions passed.
Candidate: `9ee3950c90f079a9cb181507b76a46ab5d3dc78b`, the same subset captured to
`/tmp/a2-candidate-local`: only the three expected fingerprints failed. Uncommitted
root test changes at capture time were outside the linked package and A2 inputs.
The candidate fingerprints exactly match PR #4576 CI run 38365817818,
job 115190561555. CI artifact download returned HTTP 403 in this environment;
this comparison uses independently built local captures, not that archive.

The offline causal helper used these full SHAs as baseline/candidate sources,
main as reference source, and exited 1 (`DIFFERENCES_REQUIRE_REVIEW`). Complete
manifest hashes, source trees, per-page hashes and identity census are in
[comparison.json](comparison.json).

For each of `404.html`, `docs/getting-started/index.html`, and
`docs/getting-started/coverage/index.html`, restoring only the observed native
identity `4cfe813817cfbfef` to `71005b38f1dfe2c6` reproduces the accepted normalized
bytes exactly. Every residual diff is empty. No source theme stylesheet or pack
version changed. The math-disabled fixture has no math rendering delta.

The references now use those reviewed candidate fingerprints. Native identity
freshness remains observed-only/unverified; a fresh current-head strict A2 CI
execution must still pass. All existing assertions remain enabled.
