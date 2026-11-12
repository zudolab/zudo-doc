# 2026-11-12 A2 rebaseline for home image layouts and section covers (#4751–#4754)

PR #4772 adds `home.imageLayout`, the `./home-hero` export, per-locale and per-page
`og:image` overrides, and `cover` images on home site-index cards. On the package
side it adds `.zd-home-backdrop*` and `.zd-site-nav-cover` rules to `features.css`
and a cover `<img>` branch to the `SiteTreeNav` island. No normalizer or
approvedBaseline change is made, and strict hashes still include the native build
identity.

## Captures

- **Baseline:** detached main `bbb22f93b415505298ba243e23a1742b43b86869` in a
  separate worktree, with a frozen install and `pnpm build:workspace`. The package
  `A2 no-stub` subset ran with `ZUDO_A2_CAPTURE_DIR` set, and all 20 assertions passed.
- **Candidate:** PR head `2597c8a26384bb39876d30b3d7d90366197032d1` with the same
  subset and capture. 17 assertions passed; only the three strict fingerprints failed.
  The candidate hashes equal the ones reported by the PR's first CI run
  (job 131414901259). Recapturing after adding the test-file comment for this
  rebaseline produced the same hashes.

## Comparison (`scripts/a2-causal-diff.py`)

- **Helper status:** `DIFFERENCES_REQUIRE_REVIEW`. The baseline tree equals the
  reference tree, and every page's residual diff is **empty** after the helper
  restores identity values.
- **Lengths:** raw pages are 57,089, 68,052 and 79,443 bytes in both captures.
- **Normalized pages:** only the `data-zfb-build` values change, from
  `eb8122cb68fcc5b3` to `c190c79e033ac678` (1, 2 and 4 occurrences). The theme-pack
  map and every pack version are unchanged.
- **Raw pages:** the only additional changes are the content-hashed entry names.
  `styles-3c5d8764.css` becomes `styles-78271ded.css`, from the new `features.css`
  rules. `islands-9d40b5a4.js` becomes `islands-784d47da.js`, from the `SiteTreeNav`
  cover branch. Reversing the identity and both entry names makes each raw page
  byte-identical to the baseline.

## Cause

The package source digest (the native build identity), the shared stylesheet and the
islands entry change. These fixture routes render no home page, so no visible markup,
text, island props or pack set changed.

## New strict hashes

- `404.html`: `2e450e8a973770b8d5fdb5d0db1742ac01146a1d646fd69f304a7f3454c2b8af`
- `docs/getting-started/index.html`: `1fc0d2dc0331dae1346d8ddb1b85d7f3b769295c8e507f961722ea8c20e3b4e8`
- `docs/getting-started/coverage/index.html`: `2230406e8827c527b3d613f5e715b916d5bddb8fb932ee4fd5a03c168c294cea`

This comparison explains the reference change but does not certify the PR. A fresh
final-head PR run must still execute A2 and pass.
