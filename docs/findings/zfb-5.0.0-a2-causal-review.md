# A2 causal review — ZFB 5.0.0

The accepted three-page reference is the one PR #4612 set for zfb 4.7.0. This review comes before the reference update for the zfb 5.0.0 adoption. It covers both changes on that branch: the zfb 5.0.0 family bump, and the removal of the `optional-peers` plugin now that [Takazudo/zudo-front-builder#4429](https://github.com/Takazudo/zudo-front-builder/issues/4429) is fixed upstream.

Both captures were taken locally with the CI command (`ZUDO_A2_CAPTURE_DIR=… pnpm exec vitest run --config vitest.slow.config.ts --testNamePattern "A2 no-stub: injected routes render correct HTML"` in `packages/zudo-doc`), under Node 24.22.1:

- **Baseline:** a clean worktree of main `3b251fca7bdbf28b48a940a4c8072fc49bd97653` (zfb 4.7.0). All 20 assertions passed and reproduced the #4612 hashes.
- **Candidate:** clean head `2a0441a7d3924e61cb9aecb9ef4c4dfd531a51e9`. The three strict fingerprints failed, and the other 17 selected assertions passed.

`python3 scripts/a2-causal-diff.py` compared the two captures with reference source `3b251fca7bdbf28b48a940a4c8072fc49bd97653`. It reported `DIFFERENCES_REQUIRE_REVIEW` / `OBSERVED_ONLY_UNVERIFIED_FRESHNESS`, with `residualEqual: true` and an empty residual diff on all three pages, and no changed stylesheets.

- **Lengths.** In 404, getting-started and coverage order, raw lengths are 57,025, 67,457 and 78,909. They are the same before and after the change.
- **Build identity.** The pages contain 1, 2 and 4 `data-zfb-build` values respectively, and every one changes from `6f251c980356899b` to `bb6b09fa732f8fc8`. The hashed islands bundle name moves with it (`islands-49e3e65f.js` to `islands-0490020e.js`).
- **Residual.** Replacing only those candidate values with the baseline value reproduces all three accepted normalized captures exactly, with no other byte differences.
- **New strict hashes,** in page order: `c90f0c47c13e22306ff099176c7eac68a91878e1e6fb8b9949ff535000b41040`, `e610db75ffef8cf0ac2382b148d3845c057b94d9b20316a2e3d581b7a9f947d5` and `8a43ef2a8095b3e8cf7b7deb548685547cec326bc874c6fdf43874d8beb0b8ab`.

The identity is native ZFB build metadata derived from the resolved browser graph. Two things move it here:

- The zfb 5.0.0 bundler and runtime packages replace 4.7.0 in that graph.
- With the `optional-peers` plugin gone, the throwing `katex` / `diff` virtual modules leave the graph; this fixture runs with `math` / `docHistory` off, so 4.7.0 had both shadows in place. zfb 5.0.0 leaves those rejection-handled `import()` calls external instead.

The rendered HTML is otherwise byte-identical.

`compiled.css` did not change. This update keeps the native identity in the fingerprint, the normalizer and every A2 assertion. Fresh final-head CI must still run and pass the strict A2 subset; this forensic comparison alone is not acceptance.
