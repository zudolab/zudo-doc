# A2 rebaseline for the 2026-10-12 maintenance batch (#4559)

Maintenance PR #4559 (epic #4556) changes files under `packages/zudo-doc/`: the sidebar
empty-items fallback (#4557) and the shared tsconfig `baseUrl` removal (#4558). Every
tracked file in that tree feeds zfb's native `data-zfb-build` identity, so the first A2
run executed and failed all three strict fingerprints. This record justifies the reference
update, following #4554.

## Inputs

| Role | Run / artifact | Actual checkout (`sourceHead`) | Tree | Archive SHA-256 |
| --- | --- | --- | --- | --- |
| Baseline | PR #4554 run 38259628239, artifact 11752036835 | `eda694ac4019116b7707e605b34e4dee40ca4a4b` | `64aebe86d1fc37dcacc6acdb65556933995c51de` | `4e9e08fc39b9e59c6bca53425cd6a4f0ff3edd547480f5d5003481009f68bc8f` |
| Candidate | PR #4559 run 38269727665 (job 114880713606), artifact 11756700688 | `da3f7fa5e3fe3a8b52663071edb473569b4df517` | `ad20dd86f86826bc6de5fab0c8e1aa5297b271c1` | `86bd78f2074c3f8324d2da40f57aca9c21e3b5f6bfbb1e3a48a2c2bb84cd4323` |

Reference source: main `e37130018ee2ca0bf71e39a639e328a9621d4659` (the 6.1.1 release merge). Its
tree equals the baseline capture tree, and the baseline fingerprints equal the reference being
replaced. Candidate parents: `e37130018` (main) and `fdcb17054` (maintenance base head). Both
original archives are preserved under [original/](original/).

## Causal comparison

`python3 scripts/a2-causal-diff.py` exited **1** (`DIFFERENCES_REQUIRE_REVIEW`, as designed);
full output in [comparison.json](comparison.json).

- All three residual diffs are empty: restoring only the observed identity spans
  reproduces the baseline bytes exactly, so neither the sidebar helper change nor the tsconfig
  change produces a rendered-HTML difference on these pages.
- The only observed change is the build token `6a6d1cad25507e25` → `b20a5a83f4a1f0d1`,
  coherent across every native island on every page (1/2/4 islands).
- No stylesheet changed, and source theme-pack version maps are identical.
- The candidate fingerprints equal the values the strict CI assertion received.

Local fingerprints differ from hosted ones (environment-dependent, per TESTING.md); on this
machine the same subset passed on `e37130018` and failed on the batch head, which is consistent
with the identity-only change above. Hosted capture is the evidence used here.

Identity remains **OBSERVED_ONLY_UNVERIFIED_FRESHNESS**. Acceptance still requires a fresh PR
run with A2 executed and passing. Normalization and assertions are unchanged.
