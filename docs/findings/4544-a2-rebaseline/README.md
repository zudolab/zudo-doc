# A2 rebaseline for the zfb 4.3.2 adoption (#4544)

The zfb family pin bump 4.3.1 → 4.3.2 (#4542, merge `5f324b27c`) changed the native
zudo-react build token (`data-zfb-build`). Root PR #4544's first A2 run executed and
failed all three strict fingerprints; this record justifies the reference update.

## Inputs

| Role | Run / artifact | Actual checkout (`sourceHead`) | Tree | Archive SHA-256 |
| --- | --- | --- | --- | --- |
| Baseline | PR #4540 run 38180384392 (job 114591488962), artifact 11717555927 | `9a6912f042cbf693f2b8a2bd4e4eb25128228c34` | `ad555d4d57b2086386ac457e5199e80633f2a157` | `4f26f78596d2577c96f5cf684713c56b88d6121f3dd52c14dad3cb2f05062772` |
| Candidate | PR #4544 run 38203324599 (job 114661270417), artifact 11726311507 | `1fd2c2b0a6bd4b6cecfcd7f248f8c42aa259c833` | `569f89de50ea3c0e7ba6dcffe70090582658183b` | `8aba1f046b9545ba324763a64fb9561a5405cdfb3771fe3c77af6c05591ff87f` |

Reference source: main `f2cea6fd0820d34a7b98337854ccf35d66657e8d` (the frozen baseline
the base branch was cut from; its tree equals the baseline capture tree). Candidate
parents: `f2cea6fd0` (main) and `5f324b27c` (base head). Both original archives are
preserved under [original/](original/); the candidate digest equals the one CI logged at upload.

## Causal comparison

`python3 scripts/a2-causal-diff.py` exited **1** (`DIFFERENCES_REQUIRE_REVIEW`, as designed);
full output in [comparison.json](comparison.json).

- All three residual diffs are empty: restoring only the observed identity spans
  reproduces the baseline bytes exactly.
- The only observed change is the build token `690072dfdf886a59` → `e2d8b0d6c5dafef0`,
  coherent across every native island on every page (1/2/4 islands). The raw diff also
  shows the islands bundle hash moving (`islands-ba50ad62.js` → `islands-acf4b1bd.js`),
  which the normalizer already strips.
- The fixture stylesheet is unchanged (`styles-43227719.css` on both sides), so the
  4.3.2 Wind `ignoreAttributes` fix contributes nothing to these pages; source theme-pack
  version maps are identical and no stylesheet obligation arises.

Identity remains **OBSERVED_ONLY_UNVERIFIED_FRESHNESS**. The new reference values are
the candidate's observed fingerprints; acceptance still requires a fresh PR run with A2
executed and passing on the updated candidate. Normalization and assertions are unchanged.
