# A2 causal review: ZFB 5.1.5

The accepted reference is the one PR #4661 set on main (head `e8e5fa36`, merged as `bde71c8c`). Its native build identity is `5409c8c490a5fb98`.

## Captures

Both captures are the `a2-route-parity-diagnostics` artifacts of the PR Checks A2 job: the last green run of #4661 (run 40359395191, which reproduced all three accepted references) and the first run of the bump PR #4662 (run 40385105628).

On the bump, only the three strict fingerprints failed.

## Comparison

- **Lengths:** in 404, getting-started and coverage order, the raw candidate pages are 57,089, 67,521 and 78,973 bytes, the same as the accepted capture.
- **Build identity:** the pages carry 1, 2 and 4 `data-zfb-build` values respectively. Every one changes from `5409c8c490a5fb98` to `1967cdd98144b301`.
- **Islands entry:** the raw pages also change `islands-6342ab16.js` to `islands-d48fa873.js`. Normalization already removes this name.
- **Residual:** substituting only the build identity back to `5409c8c490a5fb98` makes every candidate page hash to the accepted reference. No other byte differs.

## Cause

The bump moves the ZFB family (`zfb`, `zfb-runtime`, `zfb-md-wasm` and `zfb-adapter-cloudflare`) from 5.1.4 to 5.1.5. The ZFB package versions are inputs to the native build identity. The published 5.1.5 tarballs change only version pins and rebuilt native and WASM binaries (tokio 1.54.1 for RUSTSEC-2026-0386); the JavaScript surface is unchanged.

## New strict hashes

- `404.html`: `57a7c08573de84f2f9e1fb03ae11fc807ba7eedd8ea24c4473294b1b1ca089a7`
- `docs/getting-started/index.html`: `77465568e943b98addd658cc685b8b09f51c2e820aa00cb2d4a9e55a662198ed`
- `docs/getting-started/coverage/index.html`: `0795b4161ef95316b572b95447e8d86c40f6301cfa399f1d7eca7d4e36c4b8bc`

This comparison explains the reference change; it does not certify the PR. A fresh final-head PR run must still execute and pass A2.
