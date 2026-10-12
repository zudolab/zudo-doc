# A2 rebaseline for the sidebar 06R follow-up (#4552)

PR #4552 changes `@takazudo/zudo-doc` sidebar sources (#4549 node baseline, #4550
explicit-only disclosure persistence). That changes the package source identity, and
therefore the native zudo-react build token (`data-zfb-build`) in every A2 page. The
first A2 run on the final package tree executed and failed all three strict fingerprints;
this record justifies the reference update, following the #4545 precedent.

## Inputs

| Role | Run / artifact | Actual checkout (`sourceHead`) | Tree | Archive SHA-256 |
| --- | --- | --- | --- | --- |
| Baseline | 6.0.2 release candidate run 38210608226, artifact 11729287623 | `a241828bedbfb32a2bdde9599a7ece69ae508711` | `9747550d6da91e306ea76d8eec2fab4bba8dadd7` | `2bf3ba03c8319643423deac4f9fa1a31a913bf4c68e0021a7479d7c1a2e18ca5` |
| Candidate | PR #4552 run 38231573519 (job 114752490980), artifact 11738423028 | `438cd9226ebea2cbfa092703a57e99a883e4162a` | `f9d0867eef345682db676be733803c1c15ddd38d` | `068f6162bdadc1fe31716ba21d9270f03dd730f424f1c12586b3cd0ba92abea6` |

Reference source: main `ae962f385b31e2e213b352038787e68f1ac70c48` (6.0.2); its tree equals the
baseline capture tree, and the baseline fingerprints equal the reference being replaced.
Candidate parents: `ae962f385` (main) and `fbd694422` (PR head, final package tree). Both
original archives are preserved under [original/](original/).

## Causal comparison

`python3 scripts/a2-causal-diff.py` exited **1** (`DIFFERENCES_REQUIRE_REVIEW`, as designed);
full output in [comparison.json](comparison.json).

- All three residual diffs are empty: restoring only the observed identity spans
  reproduces the baseline bytes exactly.
- The only observed change is the build token `c9e761666436e451` → `d9314217fce5d559`,
  coherent across every native island on every page (1/2/4 islands).
- No stylesheet changed, and source theme-pack version maps are identical, so no
  stylesheet obligation arises.
- The candidate fingerprints equal the values the strict CI assertion received.

Identity remains **OBSERVED_ONLY_UNVERIFIED_FRESHNESS**. The new reference values are the
candidate's observed fingerprints; acceptance still requires a fresh PR run with A2 executed
and passing. Normalization and assertions are unchanged.
