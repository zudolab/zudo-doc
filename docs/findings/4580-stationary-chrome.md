# Stationary chrome transition evidence (#4580)

## Source and reproduction

Accepted baseline: `e91c66bbe74ef3658cf5576a1f138486210826b2`.
Implementation capture: `479309f1f095c6a1b0805fa0ed72e390e0959c04`.
Both use zudo-doc 6.2.0 and the published ZFB 4.5.0 family; no dependency or
version bump is part of this correction. Changelog page titles are content,
not deployment-version identifiers.

The built 833-page showcase was exercised from
`/docs/reference/ai-assistant-api/` through Getting Started, Reference,
Changelog, then zudo-doc 6.0.2, 5.26.4 and 5.26.1. At the baseline,
`before-swap`/`ViewTransition.ready` observations and actual CDP snapshot nodes
showed one-sided `zfb-sidebar` images during the last changelog hops, despite
unchanged sidebar geometry and navigation context. The incoming-island adapter
correctly dropped an unsafe persistence boundary, but CSS also used that
boundary for visual identity. An entering sidebar had `contentFadeIn`, opacity
0.308366 and translateY -8.29961px at a held native timestamp. This was snapshot
motion, not live layout or scroll movement.

The old root snapshot also contained the pending loading scrim. Slow-fetch
inspection confirmed full-viewport dimming. Loading feedback is now scoped to
content, extracted into its own named snapshot layer and suppressed during
native animation. Keeping this independent of the unscoped `after-preparation`
event prevents an older loader from clearing a newer pending indicator.

The active pixel oracle additionally detected an entering sidebar overpainting
the stationary header's bottom nine pixels. An explicit header snapshot group
stacking order corrects that separate compositing defect.

## Native proof contract

The tests subscribe to the public lifecycle before clicking and register
`ready`, `updateCallbackDone` and `finished` observers without awaiting readiness
inside the swap callback. CDP enumerates actual pseudo nodes; paired/one-sided
image sets are asserted explicitly. Two active frames compare region pixels and
group geometry, require changing article/TOC pixels and a real root content
animation, and remain before completion. Removing each header old/new/group
protection must fail the same stationary oracle. No screenshots are committed.

Real toggle buttons have rounded antialiased corners. Their six translucent
corner pixels blend with the animated article behind them; a repeated run
detected one-channel-value differences there while all opaque pixels remained
identical. Toggle clips therefore use the full-width opaque band derived from
computed corner radii, assert containment of the complete SVG icon, and retain
exact pixel equality and full-snapshot geometry checks. No pixel tolerance or
production styling change was introduced for this background compositing.

The smoke/sidebar fixtures cover category changes, hidden/absent regions,
replacement headers, loading overlap/failure/cancellation, state and history.
The isolated consumer installs immutable packed public files outside the
workspace, verifies package realpaths and lock stability, and exercises native
snapshots, locale replacement, mobile, history, reduced motion, absent native VT
and a separately built `dynamicPageTransition:false` output. This is aggregate
coverage across the built showcase, existing fixtures and installed consumer;
not every matrix cell is duplicated in every environment.

## Strict A2 causal review

The unchanged `A2 no-stub` subset passed all 20 tests on the accepted baseline.
Original raw HTML, normalized HTML, manifests and build logs were captured
outside the repository before edits. The immutable candidate passed 17 tests
and failed exactly the three strict fingerprint assertions before references
were updated. The unchanged `scripts/a2-causal-diff.py` compared both captures
against the independently specified accepted-reference source.

An independent reviewer checked all six complete raw/normalized diffs. Only
native `data-zfb-build` changes from `2eb654854e9b77bd` to `136d2a6604b416d5`
(1, 2 and 4 occurrences respectively), plus raw island bundle filename
`islands-c765d086.js` to `islands-54ad5874.js`, which existing normalization
already handles. All three forensic residual diffs are empty. Content, props,
markup and native comments are otherwise byte-identical. The fixture explicitly
disables dynamic transitions, so no transition bootstrap or loading markup is
expected in its output.

| Route | Reviewed candidate normalized SHA-256 |
| --- | --- |
| `404.html` | `06189ee52a3a40e6b45d9132df9c9279ad7c02ab74165769e3e6052962f454a1` |
| `docs/getting-started/index.html` | `c9c63647527cf8273d9cd305560064e0c2faa25276c8959f0ec92fc6cab7bd18` |
| `docs/getting-started/coverage/index.html` | `e70ee2934edda0752a0074241a312cb9fac8594e0bb7a08afe597e57938f667b` |

The normalizer, comparator, strict assertions, fixture configuration and
`approvedBaseline` remain unchanged. Exactly the three external fingerprint
references are replaced. This bounded causal review does not itself certify
native identity freshness, CI, integration, deployment or publication. Required
checks must execute again on the final PR head.

## Local verification

The production source tested is `479309f1f095c6a1b0805fa0ed72e390e0959c04`;
subsequent changes only refine tests and record reviewed A2 references/evidence.
Node 22.23.3, npm 10.9.9 and pinned pnpm 10.30.3 were used.

- `pnpm build:workspace` and all six existing fixture builds passed before
  browser verification. The final showcase build generated 833 pages.
- `pnpm check` and `pnpm check:e2e` passed.
- The strict `A2 no-stub` subset passed all 20 selected tests after the reviewed
  reference update.
- The actual built showcase completed the exact six-hop sequence in desktop
  light, desktop dark and mobile dark modes with `--retries=0 --repeat-each=3`:
  all nine sequences passed, including active native snapshot/pixel proof.
- The broad focused fixture/packed-consumer run used the same retry-free triple
  repetition: 171 passed, with three failures confined to the toggle corner
  sampling described above. After review corrections, the complete native,
  toggle and slow-loading proof set passed all 45 repeated cases. The packed
  consumer, state continuity, locale/version isolation, history, drawer and
  rapid/failure cases passed in the broad run.
- Slow-loading proof also reversibly reveals the actual old loading snapshot,
  requires changed article pixels, then requires exact pixel restoration after
  reinstating suppression at the same paused native time. Missing hidden CDP
  image nodes cannot certify this test.
- `pnpm b4push` attempted all 35 steps. All automated steps passed except the
  scaffold registry lookup, which failed on this environment's proxy setup.
  The unchanged `NODE_USE_ENV_PROXY=1 node scripts/check-scaffold-pin-published.mjs`
  rerun passed for both published 6.2.0 pins. This is not represented as an
  all-green original b4push run. The interactive manual-smoke prompt was skipped
  with its documented flag; actual browser verification is recorded separately.
- That run passed 1,484 root unit tests, 87 slow root tests, five retiered
  scaffold slow tests, and all package suites (including 3,585 zudo-doc tests),
  plus worker type/runtime/dry-run, CSS/template/fixture/pin/compatibility guards,
  HTML/link/image validation and automated preview smoke.

Heavy/shared-dist commands used the machine-wide guard. A disposable process
subreaper supplied the child-reaping behavior missing from this container's
PID 1; the unchanged process-death assertions then passed. No test was skipped
or weakened to accommodate zombies. The local browser was installed Chromium
151.0.7922.173 because the pinned Playwright browser download returned HTTP 403.
Final CI must cover its pinned browser. Safari/iOS, Firefox and a human-operated
interactive session were not tested locally.

## Separate held track

PR #4576 remains draft and held at
`b11a06b221131eeb891c302879d5081fc088cdde`, without an ownership handoff or direct
hold release. It was not modified. A fresh production audit of this checkout
(`pnpm audit --prod --json`, 2026-10-14) reports one low-severity KaTeX advisory
on `.>katex`; the previously reported Hono/fast-uri/smol-toml totals do not
describe current main. This npm dependency audit does not inspect Mermaid's
remote module graph. The held KaTeX continuation and combined acceptance in
#4572/#4575 remain separate from the transition correction.
