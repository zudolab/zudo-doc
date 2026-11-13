# 2026-11-13 A2 evidence for hreflang alternates (#4787): no rebaseline needed

The hreflang change (#4787) adds `<link rel="alternate" hreflang>` after the canonical
link on pages that are real content in more than one locale. It also adds
`xhtml:link` alternates to the sitemap. Output stays unchanged without `siteUrl`
and on single-locale sites. The A2 fixture
(`packages/zudo-doc/src/__tests__/fixtures/route-injection`) is that case: it has
`locales: {}` and `siteUrl: ""`. The A2 pages are therefore byte-identical, and
`scripts/__tests__/fixtures/a2-route-reference.json` is **not** changed. No
normalizer or approvedBaseline change is made.

## Captures

Both captures ran the package `A2 no-stub` subset of
`route-injection-build.slow.test.ts` with `ZUDO_A2_CAPTURE_DIR` set.

- **Baseline:** detached main `ef0a3d38055e8b269999453f8607763bc94f5125` in a
  separate worktree outside the repository, with a frozen install and
  `pnpm build:workspace`. All 20 assertions passed.
- **Candidate:** branch head `5719f66b6e5d066636824d444c4f66bd864a7109`. All 20
  assertions passed, including the three strict fingerprints, against the
  unchanged reference.
- **Manifest SHA-256:**
  - baseline `ba04becc2a02f34810e8ba4e5d1e2118754dc0dc5a34a08de416d437d8fadc0d`
  - candidate `1ceaf32fe3873041faadf321e0da2edfdf3771c52b46b71e8125634455175512`
  - They differ only in `sourceHead`.

## Comparison (`scripts/a2-causal-diff.py`)

Reference source: `a2e94e89d16b6872318a43bad243feadff9337fe`, the last commit
that changed `a2-route-reference.json` (the 11.0.0 rebaseline).

- **Helper exit:** 0, `EXACT_NORMALIZED_CAPTURE_EQUALITY`. Identity verification is
  `OBSERVED_ONLY_UNVERIFIED_FRESHNESS`, as the helper always reports.
- **Raw pages:** byte-identical. Every raw, normalized and residual diff is empty.

| Page | Bytes | Raw SHA-256 (both) | Strict fingerprint (both) |
| --- | --- | --- | --- |
| `404.html` | 57,089 | `82d7c5854c0527b33a12eca82fb67ca6bf64ab9110c2d0872b27a6070f7f85d7` | `1954e429d7f01041aa925440e9cc8929b883f32bcccb3551e734bf7c6f98fce6` |
| `docs/getting-started/index.html` | 68,052 | `c7969bbe38162522b01fab0077e72226a5a306e008c582db523b101435b8df10` | `e53e77082ef0bd55caed3dd23a4974784c62ee5164adcf25b24bb614e3c46421` |
| `docs/getting-started/coverage/index.html` | 79,443 | `ea57ab16f7f37d8161cb6034ffa7af1058c77593426b20032070f8f5060f0a6e` | `9d56b64cda83ae46649ca66234ff6289b05fc2c2119c2b0360c6654f4edc536b` |

The complete helper output is in [`comparison.json`](./comparison.json).

## Cause

The fixture has no non-default locale and no `siteUrl`, so it emits no alternates.
The single-locale, no-`siteUrl` contract is the reason the output does not change.
Multi-locale behaviour is covered by unit tests and by the showcase build instead:
the head (`head-with-defaults`, `doc-page-renderer`, `home-page`), the route
enumerators and the sitemap renderer.

This comparison does not certify the PR. A fresh final-head PR run must still execute
A2 and pass.
