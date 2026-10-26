# A2 causal review: ZFB 5.1.4

The accepted reference is the one the 8.1.1 release PR #4655 set on main (`39cad20`). Its native build identity is `1cb2cf5ca630ff99`.

## Captures

Both captures are local `ZUDO_A2_CAPTURE_DIR` runs of the same `A2 no-stub` test the PR Checks A2 job runs: one at main (`39cad20`, ZFB 5.1.3), which reproduced all three accepted references, and one at the bump.

On the bump, only the three strict fingerprints failed.

## Comparison

- **Lengths:** in 404, getting-started and coverage order, the raw candidate pages are 57,025, 67,457 and 78,909 bytes, the same as the main capture.
- **Build identity:** the pages carry 1, 2 and 2 `data-zfb-build` values respectively. Every one changes from `1cb2cf5ca630ff99` to `37f236e087bcd08c`.
- **Islands entry:** the raw pages also change `islands-a32cac03.js` to `islands-9770cacc.js`. Normalization already removes this name.
- **Residual:** substituting only the build identity back to `1cb2cf5ca630ff99` makes every candidate page hash to the accepted reference. No other byte differs.

## Cause

The bump moves the ZFB family (`zfb`, `zfb-runtime`, `zfb-md-wasm` and `zfb-adapter-cloudflare`) from 5.1.3 to 5.1.4. The ZFB package versions are inputs to the native build identity. The published 5.1.4 tarballs change only version pins and rebuilt native and WASM binaries; the JavaScript surface is unchanged.

## New strict hashes

- `404.html`: `18bc9d769ad1e8037f71eef59c4c449995656136a061a38bd6a65bd360c614ba`
- `docs/getting-started/index.html`: `eb0ab958e9e5017a46147ab8fc7efb332195337c6ca724723599e0c968342836`
- `docs/getting-started/coverage/index.html`: `5731b7b63fb6e4f8c91bad9ea13f7b6b813b5bab62ccf4b402ab7701d6871945`

This comparison explains the reference change; it does not certify the PR. A fresh final-head PR run must still execute and pass A2.
