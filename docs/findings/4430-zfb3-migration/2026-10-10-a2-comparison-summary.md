# A2 byte comparison summary (zfb 4.3.0)

Summary of the temporary `_temp-resource/4430-zfb3-migration/parity/4.3.0/a2-byte-comparison-51a2.json` (107 KB raw dump, not preserved after #4476). Hosted run: [38030181307](https://github.com/zudolab/zudo-doc/actions/runs/38030181307/job/114150085040).

- Baseline head `8e70ab58222296bc1d2e241e18438bab5651d530`, current head `51a2e3ea84aa32f0ea5dcd90af99b32777145b78`; tool status `FAIL_DIFFERENCES_REQUIRE_REVIEW`, `logEvidenceStatus: COMPLETE`. Assertions and normalizer are unchanged; the inequality is kept on purpose.
- Pages compared: `404.html`, `docs/getting-started/index.html`, `docs/getting-started/coverage/index.html`. None is raw-equal or normalized-equal.
- Reviewed differences, all native build metadata:
  - Seven `data-zfb-build` replacements (normalized spans 1 + 2 + 4 across the three pages): `5c5da6aead2494ab` becomes `3da0324c53d5fdb4` on island markers.
  - One islands bundle filename on each page (raw spans only): `/assets/islands-680c1ecb.js` becomes `/assets/islands-bbd0820a.js`.
- No other span differs (10 raw spans = 7 build-id + 3 islands-filename).
