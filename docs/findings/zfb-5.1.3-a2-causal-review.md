# A2 causal review: ZFB 5.1.3

The accepted reference is the one PR #4645 set on main (`02ca09e`). Its native build identity is `8293c6eb3297babd`.

## Candidate capture

The candidate is a local `ZUDO_A2_CAPTURE_DIR` capture of the bump commit (`6264858`), run with the same `A2 no-stub` test the PR Checks A2 job runs.

Only the three strict fingerprints failed.

## Comparison

- **Lengths:** in 404, getting-started and coverage order, the raw candidate pages are 57,025, 67,457 and 78,909 bytes, the same as the accepted capture.
- **Build identity:** the normalized pages carry 1, 2 and 2 `data-zfb-build` values respectively. Every one changes from `8293c6eb3297babd` to `8cb8ae8c51978909`.
- **Residual:** substituting only those values back to `8293c6eb3297babd` makes every normalized candidate page hash to the accepted reference. No other byte differs.

## Cause

The bump moves the ZFB family (`zfb`, `zfb-runtime`, `zfb-md-wasm` and `zfb-adapter-cloudflare`) from 5.1.2 to 5.1.3, and zdtp from 0.8.6 to 0.8.7. The ZFB package versions are inputs to the native build identity. The published 5.1.3 tarballs change only version pins and rebuilt native and WASM binaries; the JavaScript surface is unchanged.

## New strict hashes

- `404.html`: `d46a942f8866f20fb6f73bd2d2a3050d95e1fc26dc8602766f8a888dfca6bbae`
- `docs/getting-started/index.html`: `ccc4830c6ec068d08a436fb850b1b65549ba5037b366f8e3425b9a910c83c72d`
- `docs/getting-started/coverage/index.html`: `026a0380798760427618e0617e7a30fdd540becd4efb4f7167d8422d15bce1a8`

This comparison explains the reference change; it does not certify the PR. A fresh final-head PR run must still execute and pass A2.
