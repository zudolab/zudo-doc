# A2 rebaseline for the 6.1.0 build identity (#4553)

The lockstep 6.1.0 version bump (release commit `3f705ba69`) changed the native zudo-react
build token (`data-zfb-build`). Release PR #4553's first A2 run executed and failed all
three strict fingerprints; this record justifies the reference update, following #4545.

## Inputs

| Role | Run / artifact | Actual checkout (`sourceHead`) | Tree | Archive SHA-256 |
| --- | --- | --- | --- | --- |
| Baseline | PR #4552 run 38231941976, artifact 11738947744 | `7f6ac7a1603477b921d4cdcb5a51429c63a379d0` | `e67dd16c4bf3eaff7cacf62df924e3d6de41fe9e` | `ac10867680e6bf851bea842eb8a55e8b25b2baebfd87cca8ced5f38735d357de` |
| Candidate | PR #4553 run 38244494721 (job 114794892396), artifact 11744545420 | `0430091355324ac3b3354c7d6f3e0a3ac2477a89` | `ff6e84c842aa816c594bbd181fdac62ac76ea5e4` | `d22b0ec26f9b54f57bd61e993daebe83adb29cdc7cf983f89867eb852f9230b7` |

Reference source: main `85fc8a9ceb4aa35605e2696f74278017239d2427` (the #4552 merge); its tree
equals the baseline capture tree, and the baseline fingerprints equal the reference being
replaced. Candidate parents: `85fc8a9ce` (main) and `3f705ba69` (release head). Both original
archives are preserved under [original/](original/).

## Causal comparison

`python3 scripts/a2-causal-diff.py` exited **1** (`DIFFERENCES_REQUIRE_REVIEW`, as designed);
full output in [comparison.json](comparison.json).

- All three residual diffs are empty: restoring only the observed identity spans
  reproduces the baseline bytes exactly.
- The only observed change is the build token `d9314217fce5d559` → `d3dd9d2eeda6f07d`,
  coherent across every native island on every page (1/2/4 islands).
- No stylesheet changed, and source theme-pack version maps are identical.
- The candidate fingerprints equal the values the strict CI assertion received.

Identity remains **OBSERVED_ONLY_UNVERIFIED_FRESHNESS**. Acceptance still requires a fresh PR
run with A2 executed and passing. Normalization and assertions are unchanged.
