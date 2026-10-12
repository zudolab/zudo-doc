# A2 rebaseline for the 6.0.2 build identity (#4545)

The lockstep 6.0.2 version bump (release commit `dac89578f`) changed the native zudo-react
build token (`data-zfb-build`). Release PR #4545's first A2 run executed and failed all
three strict fingerprints; this record justifies the reference update.

## Inputs

| Role | Run / artifact | Actual checkout (`sourceHead`) | Tree | Archive SHA-256 |
| --- | --- | --- | --- | --- |
| Baseline | PR #4544 run 38206487970 (job 114670997670), artifact 11728120068 | `d8debc3f576de0254d3d2054db4b25594e583305` | `fc2c8722c4e702973f0061186ecec1f64233e7c1` | `81055ef1e86d3ada0a9563cf265d50e8eca3051ce52b68442a4443ce3a72062f` |
| Candidate | PR #4545 run 38209894569 (job 114681492907), artifact 11728782894 | `f489223cafd0ec3e4747d4ca3acaecae6fc6ee1a` | `f4654498bc6d0eabf643bbbc22fc82f9effbf990` | `2a6319a6218444b845e86ed8a9d602df9e48c91efffb60082c0e1465577fe1e0` |

Reference source: main `8a8b68406d5326fab63a272bc137244edcf1bf9f` (the #4544 merge); its
tree equals the baseline capture tree, and the baseline fingerprints equal the reference
being replaced. Candidate parents: `8a8b68406` (main) and `dac89578f` (release head). Both
original archives are preserved under [original/](original/); their digests equal the ones
CI recorded for the artifacts.

## Causal comparison

`python3 scripts/a2-causal-diff.py` exited **1** (`DIFFERENCES_REQUIRE_REVIEW`, as designed);
full output in [comparison.json](comparison.json).

- All three residual diffs are empty: restoring only the observed identity spans
  reproduces the baseline bytes exactly.
- The only observed change is the build token `e2d8b0d6c5dafef0` → `c9e761666436e451`,
  coherent across every native island on every page (1/2/4 islands).
- No stylesheet changed, and source theme-pack version maps are identical, so no
  stylesheet obligation arises.

Identity remains **OBSERVED_ONLY_UNVERIFIED_FRESHNESS**. The new reference values are
the candidate's observed fingerprints; acceptance still requires a fresh PR run with A2
executed and passing on the updated candidate. Normalization and assertions are unchanged.
