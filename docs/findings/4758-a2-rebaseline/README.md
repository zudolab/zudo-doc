# 2026-11-12 A2 rebaseline for the Tauri / find-in-page retirement (#4758)

PR #4759 retires Tauri desktop app support. On the package side it removes the
`FindInPageInit` body-end island, the `.find-match` / `.find-match-active` rules in
`theme.css`, and the find-bar overrides in the Beacon and E-Ink packs. It also edits
a comment in the Bauhaus pack, which changes that stylesheet too. The three pack
versions move from `1.0.1` to `1.0.2` as `?v=` cache-busters. No normalizer or
approvedBaseline change is made, and strict hashes still include the native build
identity.

## Captures

- **Baseline:** detached main `4bba02eb19dc841aa595090e96ee4fc49a02ff8e` with a frozen
  install and `pnpm build:workspace`. The package `A2 no-stub` subset ran with
  `ZUDO_A2_CAPTURE_DIR` set, and all 20 assertions passed.
- **Candidate:** PR head `ef95d79` (full SHA recorded by the helper) with the same
  subset and capture. 17 assertions passed; only the three strict fingerprints failed.

## Comparison (`scripts/a2-causal-diff.py`)

- **Helper status:** `DIFFERENCES_REQUIRE_REVIEW`. The baseline tree equals the
  reference tree, and every page's residual diff is **empty** after the helper
  restores identity values and same-key pack versions.
- **Lengths:** raw pages are 57,027, 67,989 and 79,376 bytes in both captures.
- **Normalized pages:** two things change. The `data-zfb-build` values move from
  `5524bd9db4476f35` to `eb8122cb68fcc5b3` (1, 2 and 4 occurrences). In the
  theme-pack bootstrap map, `bauhaus`, `beacon` and `eink` move from `1.0.1` to
  `1.0.2`.
- **Raw pages:** the only additional changes are the content-hashed entry names.
  `styles-3eda7a32.css` becomes `styles-3c5d8764.css`, because the `.find-match*`
  rules are gone from the package theme. `islands-5eb72736.js` becomes
  `islands-9d40b5a4.js`, because `FindInPageInit` is no longer in the islands graph.
- **Changed pack stylesheets** (reported by the helper): `bauhaus`, `beacon` and `eink`.
  Each has a new source version.

## Cause

Deleting the find-in-page module and its styles changes the package source digest,
which is the native build identity. It also changes the islands entry and the shared
stylesheet. The pack CSS edits require the cache-buster bumps. No visible markup,
text, island props or pack set changed. The `FIP retired` cases in
`route-injection-build.slow.test.ts` separately assert that neither the page nor the
islands bundle carries `FindInPageInit`.

## New strict hashes

- `404.html`: `f8d4752f29f273cd03a37afff257ca47d26eb05fe9b1db8da3e4186b4a05bfec`
- `docs/getting-started/index.html`: `32d331b1ec9443f0b6255657594f8e12f84accf155554e3d8ba425e017f75617`
- `docs/getting-started/coverage/index.html`: `803b50f173647736047957e33ff8a38d370c338f4f10ab7876d543abcd2c74da`

This comparison explains the reference change but does not certify the PR. A fresh
final-head PR run must still execute A2 and pass.
