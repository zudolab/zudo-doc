# A2 rebaseline for the 6.0.1 release (#4540)

The 6.0.1 version bump changed `@takazudo/zudo-doc`'s linked-package bytes, which feed
zfb's native zudo-react build token (`data-zfb-build`). Release PR #4540's first A2 run
failed all three strict fingerprints; this record justifies the reference update.

## Inputs

| Role | Run / artifact | Actual checkout (`sourceHead`) | Tree | Archive SHA-256 |
| --- | --- | --- | --- | --- |
| Baseline | PR #4539 run 38163057447, artifact 11711265803 | `cf9ad38226d5d96f211cc88919d4409b197b2a59` | `5955ce76cd83c31319ed1d7fe4e9187be2a5882a` | `c2748850b67f57ef21f9445406cc6f501fa491beca22529ab9981668ab3a9011` |
| Candidate | PR #4540 run 38179648516 (job 114589302189), artifact 11716334096 | `bdf9991301ba05bfa07a816ba989bce7823a7ec4` | `97d6b6b79cc4992afaa68e522383cf46288c39d8` | `87b429e57872c4ffc52d1cf5bd3a2430e9e128bdcd7aaffc76764dc175b446d4` |

Reference source: main `41faa9157c15a838a93a9df0da39709fd660e74c` (tree equals the
baseline tree). Candidate parents: `41faa915` (base) and `ad61e241` (release commit).
Both original archives are preserved under [original/](original/).

## Causal comparison

`python3 scripts/a2-causal-diff.py` exited **1** (`DIFFERENCES_REQUIRE_REVIEW`, as designed);
full output in [comparison.json](comparison.json).

- All three residual diffs are empty: restoring only the observed identity spans
  reproduces the baseline bytes exactly.
- The only observed change is the build token `aae1d8c79c0ac792` → `690072dfdf886a59`,
  coherent across every native island on every page (1/2/4 islands).
- Source theme-pack version maps are identical; no stylesheet obligation arises.

Identity remains **OBSERVED_ONLY_UNVERIFIED_FRESHNESS**. The new reference values are
the candidate's observed fingerprints; acceptance still requires a fresh PR run with A2
executed and passing on the updated candidate. Normalization and assertions are unchanged.
