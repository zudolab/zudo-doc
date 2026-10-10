# Published 4.2.1: changed props activate a never-mounted visible island under a persisted ancestor before visibility

Exact published packages: `@takazudo/zfb@4.2.1` and `@takazudo/zfb-runtime@4.2.1`; Node 22, Chromium 151. The consumer uses only public `Island`, `ClientRouter`, `signal`, and `getScope().onActivate`. No consumer persistence helper, dependency patch, private marker/build-identity fabrication, or network/scheduling stub is involved.

This appears to be the intersection of closed #1432/#1409 (force replacements of **already-mounted** deferred roots, preserve ordinary first-time deferred hydration) and #3420/#3421 (changed nested islands under persisted ancestors). No matching current report was found in the manager's open/closed search.

## Actual behavior

A `when="visible"` skip-SSR Counter is below a 2000px spacer inside a persisted `<header>`. On `/pending-a/`, it has zero activations, zero cleanups, one fallback reservation, and no counter. Click an ordinary internal link to `/pending-b/`, whose only island prop change is `label: "original"` → `"incoming"`.

The Document and timeOrigin remain unchanged. The marker stays at `top=2097.875px`, viewport height is `720px`, and `scrollY=0`; nevertheless the fallback is replaced, the mounted marker appears, and the public activation count becomes one. There was never a live island instance to remount. The incoming label is fresh; stale props are not the defect.

Negative controls:

- Loading `/pending-b/` directly leaves activation zero until explicit visibility.
- The same changed-props SPA route pair without the ancestor persistence attribute leaves activation zero until explicit visibility.
- The native persisted route pair reproduces without importing any consumer helper.

Existing combined consumer diagnostic run: 8 passing controls, 1 strict pending-defer assertion failure. The separate isolated npm consumer reproduces with **2 passes / 1 failure (3.5s)**; shared heavy guard reports FAIL (5s). Direct-load and nonpersisted controls pass; persisted changed-props navigation fails expected zero activations with actual one. Exact registry manifest and pnpm lockfile are retained. No zudo-doc dependency, workspace links, private build metadata, stubs, or dependency patches are present. Manager verified both probe ports were free after browser exit.

## Minimal authored layout

```tsx
import { Island } from "@takazudo/zfb";
import { ClientRouter } from "@takazudo/zfb-runtime";
import Counter from "./counter";

export default function Layout({ label, next }) {
  return <html><head><ClientRouter /></head><body>
    <a href={next}>next</a>
    <header data-zfb-transition-persist="pending-header">
      <div style={{ height: "2000px" }}>spacer</div>
      <Island when="visible" ssrFallback={<div>Await visibility</div>}>
        <Counter label={label} />
      </Island>
    </header>
  </body></html>;
}
```

Counter is a normal named `"use client"` entry. It increments an observable test counter in the public scope activation callback and returns a cleanup callback; its local signal is otherwise ordinary. Pages a/b share layout/topology and differ only in the immutable label and destination page title.

## Expected behavior

A first-time mount stays deferred until its visible condition is satisfied, reads the incoming exact props then, and activates once. Immediate replacement for an **already-mounted** deferred root should keep the #1432 behavior. The strict browser assertion remains zero activations before explicit scroll; it has not been weakened to the observed value.

## Published-source causal pointer

In `@takazudo/zfb/dist/runtime.js`, `clearMountedForRemount()` returns true after consuming the remount flag whether or not `rootHandle(el)` existed (around lines 376–385). `mountNewIslands()` passes that as `force`; `fireInlineMount()` invokes `fire()` and returns before reading `data-when` (around lines 508–513). The nested changed-pair path can set that flag on a never-activated root. This is a source-supported diagnosis, not an upstream implementation proposal or patch.

## Reproduction gate

Isolated project `/tmp/zudo421-pending-native` contains exact package manifest/lock, four pages (persisted a/b and nonpersisted a/b), native Counter/layout, and three Playwright cases. Install: `pnpm install --ignore-scripts`. Start/render actual zfb dev through Playwright's webServer and run `pnpm exec playwright test --config playwright.config.mjs` with an available Chromium executable. The persisted changed-props case intentionally retains the failing zero-activation assertion. Direct-load and nonpersisted controls must remain passing. Before/after marker attrs, bounds, scroll, lifecycle and document-request evidence are attached before the assertion.

No consumer workaround or upstream implementation has been applied. This newly exposed native browser gate keeps migration release verification blocked pending published resolution or explicit upstream contract disposition.
