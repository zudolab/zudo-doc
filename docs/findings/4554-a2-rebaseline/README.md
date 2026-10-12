# A2 rebaseline for 6.1.1 and zfb 4.3.3 (#4554)

Release PR #4554 adopts zfb 4.3.3 (RUSTSEC-2026-0333 frontmatter parser fix) and bumps the
lockstep version to 6.1.1. Its first A2 run executed and failed all three strict fingerprints;
this record justifies the reference update, following #4545.

## Inputs

| Role | Run / artifact | Actual checkout (`sourceHead`) | Tree | Archive SHA-256 |
| --- | --- | --- | --- | --- |
| Baseline | PR #4553 run 38245564109, artifact 11745566330 | `9b38681745164a518b1942fb029f9fc80fc0e898` | `823d63f2666fe6c7941cc4ab96d0c7c3fc17a271` | `84c4a09969b815293019ffebc3b29534f46c9e8e0e1ceb75bda3979b08cdd7e3` |
| Candidate | PR #4554 run 38258517716 (job 114842721367), artifact 11751092084 | `e925e2bd35b4caf09f5eb0b4a5884b77bf5f89b9` | `b0d8ebe7c78f75d58f4eebcf6c84c02dbfcf5f94` | `e5ed4b854f2048235da700a810cc4f18fbaa173aef06117bc6e774c818b4190c` |

Reference source: main `06cade69ca63ffed22438783c6f45ceae14d225f` (the 6.1.0 release merge); its
tree equals the baseline capture tree, and the baseline fingerprints equal the reference being
replaced. Candidate parents: `06cade69c` (main) and `abc429a2a` (release head). Both original
archives are preserved under [original/](original/).

## Causal comparison

`python3 scripts/a2-causal-diff.py` exited **1** (`DIFFERENCES_REQUIRE_REVIEW`, as designed);
full output in [comparison.json](comparison.json).

- All three residual diffs are empty: restoring only the observed identity spans
  reproduces the baseline bytes exactly, so the zfb 4.3.3 engine change produces no
  rendered-HTML difference on these pages.
- The only observed change is the build token `d3dd9d2eeda6f07d` → `6a6d1cad25507e25`,
  coherent across every native island on every page (1/2/4 islands).
- No stylesheet changed, and source theme-pack version maps are identical.
- The candidate fingerprints equal the values the strict CI assertion received.

Identity remains **OBSERVED_ONLY_UNVERIFIED_FRESHNESS**. Acceptance still requires a fresh PR
run with A2 executed and passing. Normalization and assertions are unchanged.
