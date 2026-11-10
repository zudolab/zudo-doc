# A2 causal review — ZFB 6.0.1

Task #4717 adopts the stable ZFB 6.0.1 family from 5.2.2. The isolated baseline at main `ab9644bb16d8ef15526b3c12730d79b3b887f862` (tree `6847b8420c07841a4a9bf3857b0e4027c35d2ca6`) passes the A2 subset and reproduces all three accepted reference hashes. The candidate at `cd621258720cb4a4815d0307061b26ace8f9439d` (tree `97b800d392b557dbd848cf5500599ec99052418d`) passes the 17 behavioral assertions and fails only the three strict fingerprints. Its local capture reproduces PR Checks run `42769330929`'s three observed hashes.

Both captures were made with the existing `ZUDO_A2_CAPTURE_DIR` hook outside the linked package, under the machine-wide heavy guard. The offline `scripts/a2-causal-diff.py` validates their raw/normalized consistency, baseline reference hashes, unchanged normalizer, immutable source metadata, island order/protocol and source pack versions. The normalizer SHA-256 is `0c769b0c4c2e86ac950dcafc0a5866d9740ac68a90796f3cc7b4b3d3203a3b82`. Baseline and candidate capture-manifest SHA-256 values are `a0a7448a7790c886ea165c404d3d7308782a24952b39ece3d48ca333bf9781a2` and `71d4bf19ed1475f223942b388cd4aa0099e01011d8c3cd27624d43be4e0370dd`.

In 404, getting-started and coverage order, raw lengths remain 57,089, 68,052 and 79,443 bytes; normalized lengths remain 57,095, 68,058 and 79,449. Native `data-zfb-build` attributes occur 1, 2 and 4 times. Each changes from `5dc2d91b39c32ee6` to `83deded1b7c8303a`. Reversing only those values makes every normalized page byte-identical to its accepted baseline. Raw pages additionally change the islands entry filename from `islands-7e38a4d7.js` to `islands-6622a70d.js`; reversing both identities makes every raw page byte-identical. There are no residual differences, changed stylesheet references, pack versions, protocol, prose or structural changes.

The upstream ZFB 6 changelog explicitly changes native bundler identity inputs from esbuild to Rolldown for config/plugins and invalidates island build identity. The dependency and peer metadata change also participates in identity inputs. The comparison establishes the observed identity-only HTML difference; it does not independently certify freshness, runtime behavior, CI or release readiness. Assertions and normalization remain unchanged.

New strict fingerprints:

- `404.html`: `e4b1302559534dc7dcd1828a0846c785136483abc6731b16317fab443ef4ee5d`
- `docs/getting-started/index.html`: `2842e3ee11c9d1b81202000a36a951a3993af5c73dada3cb0e3a473a2f5c7427`
- `docs/getting-started/coverage/index.html`: `3f0f6cd0f5de49b3b0870ff778d4b7f9f1e46000de07ed229e72845dfcefae58`

The md-wasm reviewed release manifest is separately refreshed to published 6.0.1 after checking the lengths and SHA-256 hashes of all four installed WASM artifacts. Its 18 release-contract checks pass.

Merge remains blocked by a genuine packed-consumer npm install failure: ZDTP 0.9.1 declares ZFB `^5.1.2`, which conflicts with this candidate's ZFB `^6.0.1`. The same `mermaid-packed-output.slow.test.ts` failure occurs locally and in PR CI. Upstream report: https://github.com/Takazudo/zudo-design-token-panel/issues/1096. Do not bypass peer enforcement or weaken that test. A compatible upstream publication is required. A coordinated zudo-doc/generator release is also outside this adoption PR; generated pins are not delivered to users until that release.
