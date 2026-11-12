# 2026-11-12 A2 rebaseline for homepage navigation composition (#4771)

PR #4773 adds the described `SiteTreeNav` variant and its tree geometry, `WideSectionHeading`,
`DocCardNav`, `DocCardGrid layout="auto"` and the optional `home.sections` recipe. On the package
side it adds the `SiteTreeNav tree geometry` rules to `features.css` and rewrites the
`SiteTreeNav` island markup. No normalizer or approvedBaseline change is made, and strict hashes
still include the native build identity.

## Captures

- **Baseline:** detached main `2b67af76ba78c1da6117a21efb72878fedcdc151` in a separate worktree,
  with a frozen install and `pnpm build:workspace`. The package `A2 no-stub` subset ran with
  `ZUDO_A2_CAPTURE_DIR` set, and all 20 assertions passed.
- **Candidate:** PR head `cefe957b4a67ad54e0d654443865d0f62355f4f4` with the same subset and
  capture. 17 assertions passed; only the three strict fingerprints failed.

## Comparison (`scripts/a2-causal-diff.py`)

- **Helper status:** `DIFFERENCES_REQUIRE_REVIEW`. The baseline tree equals the reference tree,
  and every page's residual diff is **empty** after the helper restores identity values.
- **Lengths:** raw pages are 57,089, 68,052 and 79,443 bytes in both captures.
- **Normalized pages:** only the `data-zfb-build` values change, from `c190c79e033ac678` to
  `325a38e9cb1e3530` (1, 2 and 4 occurrences). The theme-pack map and every pack version are
  unchanged.
- **Raw pages:** the only additional changes are the content-hashed entry names.
  `styles-78271ded.css` becomes `styles-8f862a7c.css`, from the new `features.css` rules.
  `islands-784d47da.js` becomes `islands-e3c2af22.js`, from the rewritten `SiteTreeNav` island.

## Cause

The package source digest (the native build identity), the shared stylesheet and the islands
entry change. These fixture routes render no home page and no site tree, so no visible markup,
text, island props or pack set changed.

## New strict hashes

- `404.html`: `99d38024f7263faf9f759d6da718c2decc391bddb476c4a225288ca896fcbe38`
- `docs/getting-started/index.html`: `652e96d57bd16e9412971f1231b0dd40d69027388705d2fbfc07981d4e37c429`
- `docs/getting-started/coverage/index.html`: `5991bc510d235d007e2c87dbc62d915873a75a07c1801648130ebb6262a6a7d7`

This comparison explains the reference change but does not certify the PR. A fresh final-head PR
run must still execute A2 and pass.
