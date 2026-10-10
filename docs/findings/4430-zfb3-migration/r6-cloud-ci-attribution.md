# R6 cloud CI contract reconciliation

Source under review: `79f60b78e916ead96c8e351df057636588762025`.
Prior passing reference: `5736e0d8` (restored 06R toolbar).
This reconciliation changes only E2E expectations and the external A2 reference.
It changes no product source, generated CSS, assertion, or HTML normalizer.

## All three A2 differences are attributed

Separate clean checkouts on the same cloud machine reproduced all old reference
hashes at 5736e0d8 and all three received CI hashes at 79f60b78. Both used pinned
pnpm 10.30.3, published zfb 4.3.0, the existing build pipeline and the unchanged
whole A2 subset. Local Node was 24.19.0; CI's Node 22 remains the final runtime gate.

| Page | Prior normalized SHA-256 | R6 normalized SHA-256 |
| --- | --- | --- |
| 404.html | b956502c6ad14395c470b01379eb888ee5748a47f198089a201274e86c4ebf5b | 8e34e00cb290eab0c94b48e0bdd0500d0b6837461394e0a6b22c28f6ff7d36ae |
| docs/getting-started/index.html | 67e62f6cb88f5daef8285c76015c69f401021962c060a4ddc9b414310a4d4113 | e76f6a551241d80c7fbb8cb28de3c956092858774e30f978c39bdd03ff371517 |
| docs/getting-started/coverage/index.html | ff2f7a68387a62a86a063947cd48f34f7def6162c914c1e216dd7ff6829634dd | a8929fa3058782012a6a92bbfd8aab84a131f6b818dbd476bc2dc7ea0d24b9dc |

Native build identity changes from `65bc198a66398cd2` to `d1558350bc4d59a9`.
Replacing only that identity reproduces the prior 404 hash exactly.

For both docs pages, the desktop SidebarTree starts at the highest available
tree. R6 removes the entire disabled toolbar and its technical hint from that
SSR state, inserting the native conditional boundary instead. It adds the
stable filter separator and marker, input focus-visible outline with
`outline-offset:-4px`, first-root `first:border-t-0`, and occurrence IDs on
branch focus controls. Native comment numbering changes with that component
structure. The mobile empty sidebar receives only the filter separator/outline.
Transported SidebarTree props are byte-identical.

Attribution used parse5 source locations to replace only the current desktop
SidebarTree element with its prior bytes, reverse the two mobile filter/input
attribute changes, and restore the old native build identity. The existing
`sha256Html` then reproduces each prior hash exactly. No residual change
remains anywhere outside those named regions. A separate parsed desktop-tree
comparison, excluding comments solely for diagnosis, confirms identical DOM,
text and attributes after removing the old toolbar and reversing only the
listed attributes. This diagnostic comparison is not used by the parity gate.

The checked-in external reference retains the new native identity and all
comment/transport bytes. The slow test, authored fixture content, assertions,
and `scripts/parity-html-normalize.mjs` remain unchanged.

## Seven sidebar failures used superseded expectations

The original head's E2E failures expected Restore after Broaden reached the
highest tree, technical scope text, disabled Broaden at the top, or immediate
focus on Broaden instead of the category link. Accepted R6 hides the complete
toolbar at the top and retains category focus while narrowing.

The revised spec asserts toolbar absence, refocuses a branch before Restore,
and checks the category link and safe active branch focus destinations.
It retains the authored multi-root forest/disclosure reset, nearest editorial
ancestor traversal, twelve-level tree, mobile drawer, touch, native links,
modified new-tab links, reload, Back/Forward, filter, URL/hash, article,
document scroll and desktop TOC coverage. No test is skipped or removed.

Local verification:

- Prior unchanged A2 subset: 20 passed.
- Current original A2 subset: 17 passed, three matching CI fingerprint failures.
- Current reviewed external reference: 20 passed; all normalized captured bytes
  stay identical, including native identity/transport/comments. Only the
  already-normalized content-hashed asset URLs differ between rebuilds.
- `pnpm check:e2e`: passed without adding or overriding dependencies.
- Current sidebar fixture built through `E2E_FIXTURES=sidebar bash e2e/setup-fixtures.sh`.
- Revised `sidebar-broader-tree.spec.ts`: all 15 passed in guarded Chromium.
- An initial browser launch overlapped Chromium executable extraction and failed
  with ETXTBSY; the completed-install rerun above passed.

## Historical diagnostics remain separate from current contract failures

Original-head PR Checks:
[38068765650](https://github.com/zudolab/zudo-doc/actions/runs/38068765650).
A2 failed three fingerprints and E2E failed the seven obsolete expectations.
Type Check, fast/slow root lanes, package unit tests, Build Site, HTML validate,
Worker Contract Proof and Theme A11y Audit passed. Ordinary Preview Deploy
completed at 2026-10-10 16:48:03 UTC.

Original-head Migration Hosted Parity:
[38068761949](https://github.com/zudolab/zudo-doc/actions/runs/38068761949).
The complete zudo-doc slow suite (including its packed fixtures) passed 130 tests
and failed the same three A2 hashes. This workflow has no separate later packed
step.
The create-zudo-doc full slow lane and published 4.3.0 consumer passed.
Both browser variants captured all 65 unique states and screenshots with zero
capture errors. The historical comparison reports 47 height differences, all
on `nav` or `sidebarTree`; no other measured property differs.
The complete A2 historical comparison also deliberately exits red when
baseline/current bytes differ. These comparators remain unchanged and retain
their failure evidence; refreshing current fingerprints does not make a claim
that historical baseline and accepted R6 are byte- or height-identical.

Human acceptance is maintained separately in the
[authoritative owner record](https://github.com/zudolab/zudo-doc/pull/4477#issuecomment-6100228862).
This evidence does not complete that gate, remove #4512 SKIP, authorize merge,
mark the PR ready, or authorize release/publication/production deployment.
