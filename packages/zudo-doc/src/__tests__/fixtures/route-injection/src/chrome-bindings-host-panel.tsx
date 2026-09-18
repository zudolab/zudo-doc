/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-mounted design-token-panel fixture (#4286, epic #4283) — a SECOND
// chromeBindings module, distinct from `./chrome-bindings.tsx`, used ONLY by
// the "DTP host-owned" describe block in
// `../route-injection-build.slow.test.ts`.
//
// The scenario under test (#4261): a host mounts its OWN design-token panel
// through the public `@takazudo/zudo-doc/design-token-panel-bootstrap`
// subpath while the PACKAGE panel stays off (`designTokenPanel: false`). That
// combination only works when `bundleZdtp: true` is also set — otherwise the
// preset shadows `@takazudo/zudo-doc/zdtp-loader` with a throwing stub (#4201)
// and the mounted panel's `loadZdtp()` rejects the moment it is opened,
// despite the build going green. See `bundleZdtp` in
// `packages/zudo-doc/src/config.ts` for the full contract.
//
// This module itself is a plain SSR host-callables module (no "use client"),
// exactly like `./chrome-bindings.tsx` — it wires the "use client" island
// component from `./host-panel-bootstrap-island.tsx` into the `BodyEndIslands`
// slot, wrapped in `Island({ when: "load" })` (no `ssrFallback` — it renders
// nothing on either side, the same shape
// `doc-body-end-islands/design-token-panel-island.tsx:52-55` uses for the
// package-owned panel).
//
// Every other `ChromeHostBindings` slot is left at its package-default stub.

import type { VNode } from "preact";
import { Island } from "@takazudo/zfb";
import type { ChromeHostBindings } from "@takazudo/zudo-doc/factory-context";
import { HostPanelBootstrap } from "./host-panel-bootstrap-island.js";

export const chromeBindings: ChromeHostBindings = {
  BodyEndIslands: () =>
    Island({
      when: "load",
      children: <HostPanelBootstrap />,
    }) as unknown as VNode,
};
