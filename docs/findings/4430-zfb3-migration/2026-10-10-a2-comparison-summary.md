# A2 byte comparison summary (zfb 4.3.0)

Summary of the temporary `_temp-resource/4430-zfb3-migration/parity/4.3.0/a2-byte-comparison-51a2.json` (107 KB raw dump, not preserved after #4476). Hosted run: [38030181307](https://github.com/zudolab/zudo-doc/actions/runs/38030181307/job/114150085040).

- Baseline head `8e70ab58222296bc1d2e241e18438bab5651d530`, current head `51a2e3ea84aa32f0ea5dcd90af99b32777145b78`; tool status `FAIL_DIFFERENCES_REQUIRE_REVIEW`, `logEvidenceStatus: COMPLETE`. Assertions and normalizer are unchanged; the inequality is kept on purpose.
- Pages compared: `404.html`, `docs/getting-started/index.html`, `docs/getting-started/coverage/index.html`. None is raw-equal or normalized-equal.
- Reviewed differences, all native build metadata:
  - Seven `data-zfb-build` replacements (normalized spans 1 + 2 + 4 across the three pages): `5c5da6aead2494ab` becomes `3da0324c53d5fdb4` on island markers.
  - One islands bundle filename on each page (raw spans only): `/assets/islands-680c1ecb.js` becomes `/assets/islands-bbd0820a.js`.
- No other span differs (10 raw spans = 7 build-id + 3 islands-filename).

## Closeout refresh at `61d52377b` (2026-10-10, epic #4502)

The required A2 No-Stub Parity Gate ([PR Checks 38042425579](https://github.com/zudolab/zudo-doc/actions/runs/38042425579)) and the full slow suite ([Migration Hosted Parity 38042422444](https://github.com/zudolab/zudo-doc/actions/runs/38042422444), 130/133, the same three A2 cases) failed on the three normalized-HTML hashes after the closeout sidebar fix (#4507). Manager causal review of the hosted `migration-a2-comparison-61d52377…` artifact (character-level diff of baseline versus current normalized HTML):

- **Native build ID.** Every island `data-zfb-build` changed to `ece0807ccd1f2c64`. This is the same reviewed category as before; the ID changed because the sidebar island bundle changed.
- **One class token.** `ml-auto` was added to the ◎ "Show only this branch" button on `/docs/getting-started/` and `/docs/getting-started/coverage/`. This is the intended #4507 change. On linked rows the sibling anchor is `flex-1`, so `ml-auto` has no free space to act on and causes no positional change. #4507 measured Δ0 across all 60 parity states.
- **Nothing else.** No other byte differs in props, headings, navigation or content. `404.html` changes by build IDs only.

The reference fixture `scripts/__tests__/fixtures/a2-route-reference.json` is updated to the hosted-computed hashes, which equal the sha256 of the artifact's current normalized HTML:

- `404.html`: `b96581ea…5dea0`
- `docs/getting-started/index.html`: `2fe746e2…f7fd6`
- `docs/getting-started/coverage/index.html`: `15124e65…edd95`

The normalizer and the assertions are unchanged. The historical byte diagnostic still keeps its reviewed inequality.
