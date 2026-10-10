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

## Refresh after zdtp 0.8.6 at `fe4e83d9d`

The required A2 gate ([PR Checks 38043993981](https://github.com/zudolab/zudo-doc/actions/runs/38043993981)) and the full slow suite ([38043990580](https://github.com/zudolab/zudo-doc/actions/runs/38043990580), the same three cases, 130/133) failed again after the zdtp 0.8.6 dependency change. A character-level diff of the hosted current normalized HTML (`61d52377b` versus `fe4e83d9d`) shows **only** the native build ID changing on every island, from `ece0807ccd1f2c64` to `5644bd5782d74551`. Nothing else changed: no markup, props or content. The lockfile change feeds the native build fingerprint, and zdtp 0.8.6's `dist/` is byte-identical to 0.8.5.

Updated reference values, which equal the sha256 of the hosted current normalized HTML:

- `404.html`: `a03f277b…7ebac92`
- `docs/getting-started/index.html`: `b3c1bb4b…f15399b2c`
- `docs/getting-started/coverage/index.html`: `8ac65e3c…7e4379357`

The normalizer and the assertions are unchanged.

## Accepted 06R toolbar refresh at `4a173167` (2026-10-10, #4500 / PR #4477)

The owner requested the accepted compact 06R toolbar during Mac acceptance. The implementation restores the space-between action row, icon-only Restore with localized title/accessible name, and a separate muted hint row. The [prior passing A2 diagnostics](https://github.com/zudolab/zudo-doc/actions/runs/38048316951) and [candidate failing A2 diagnostics](https://github.com/zudolab/zudo-doc/actions/runs/38050697293/job/114209050320) contain complete raw and normalized bytes for all three pages. GitHub built PR merge commits: baseline `d2166a8211ce49de320d94bd70906aea7f7610c6` has parent `7b5e302723b872591a27feffd795c3a4e9894854`; candidate `9290977bd43a9dced826f8b481532c88b429100c` has parent `4a173167b9b0b783e3f2fa742e5e7f259a448691`. Both merge into the same `337b9f110793dccb4759bddd5273eab38cd9d2f0` base.

Complete byte attribution:

- **Native identity:** every `data-zfb-build` changes from `5644bd5782d74551` to `65bc198a66398cd2`: one replacement on `404.html`, two on the getting-started index, and four on coverage. The sidebar island source and interaction test changed; the external fingerprint update does not change the linked package's identity.
- **Raw asset filename:** exactly one `/assets/islands-bb40ee21.js` becomes `/assets/islands-cce3e90c.js` on each page. The existing, unchanged normalizer already canonicalizes these bundle filenames.
- **Intentional toolbar markup:** the getting-started and coverage pages each grow by exactly 224 bytes. The old wrapping toolbar becomes an outer container plus a `justify-between` action row; the broaden button loses its border/padding and gains the 26px minimum height, weight, focus outline and disabled-opacity classes. The hint changes from a span to a separate `text-micro` div with 3px top margin. The empty Restore `Show` boundary moves inside the action row, so native text/show markers change order and numbering. Restore is initially absent in these SSR fixtures; its SVG, title and aria-label appear only after a scope change and were verified on the deployed desktop/mobile preview. `404.html` has no toolbar markup delta.
- **Nothing else:** reversing the exact captured toolbar blocks and all seven build IDs reproduces every baseline normalized byte and its original fingerprint. Reversing the three exact bundle filenames as well reproduces every baseline raw byte. No unrelated markup, props, content, navigation, URL, script, heading, runtime protocol, or transport change remains. This proof compares complete files, without filtering other differences or broadening normalization.

The three updated references are the SHA-256 of the captured candidate normalized files:

| Page | Previous fingerprint | Accepted toolbar fingerprint |
|---|---|---|
| `404.html` | `a03f277bf6b02a3925dbf96599f01183173e2be4edb85e2edfe1688d37ebac92` | `b956502c6ad14395c470b01379eb888ee5748a47f198089a201274e86c4ebf5b` |
| `docs/getting-started/index.html` | `b3c1bb4b71b858829fd928c6e04a8a18fb9373b24b8be8591e67b29f15399b2c` | `67e62f6cb88f5daef8285c76015c69f401021962c060a4ddc9b414310a4d4113` |
| `docs/getting-started/coverage/index.html` | `8ac65e3c7f98586bdf7f7eb7e3a8c470755dc739ae28d32773271bb7e4379357` | `ff2f7a68387a62a86a063947cd48f34f7def6162c914c1e216dd7ff6829634dd` |

Only `scripts/__tests__/fixtures/a2-route-reference.json` and this findings log change in the refresh. The normalizer, slow-suite assertions, package sources, and historical baseline/current diagnostic remain unchanged. Human Mac IME and remaining acceptance steps are still incomplete; #4512 SKIP remains.

Local Mac A2 verification passed 17 cases and failed only the three fingerprints: the local native build ID is `75e15d72fcac452b`, while hosted capture uses `65bc198a66398cd2`. Substituting that exact ID in the local normalized files reproduces the candidate hosted bytes and SHA-256 on all three pages. The hosted fingerprint references are retained, and the assertions remain strict; local fingerprint failures are not reported as passes.
