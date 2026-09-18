"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-mounted design-token-panel island fixture (#4286, epic #4283).
//
// The actual CLIENT island `./chrome-bindings-host-panel.tsx` mounts, kept in
// its own "use client" module — mirrors the split between
// `doc-body-end-islands/design-token-panel-island.tsx` (SSR-side composer,
// no "use client") and `../../design-token-panel-bootstrap.tsx` (the real
// "use client" island it wraps in `Island({ when: "load" })`).
//
// Calls the host through the PUBLIC `@takazudo/zudo-doc/design-token-panel-bootstrap`
// subpath with the fixture's OWN `buildDesignTokenPanelConfig` builder — never
// the package default — proving a host can mount its own panel with the
// package panel (`designTokenPanel`) off. Goes through
// `runDesignTokenPanelBootstrapOnce`, not the raw `bootstrapDesignTokenPanel`,
// for the same reason the package island does: the call sits in the render
// body, and a second bootstrap (re-render, or a soft nav with
// `dynamicPageTransition` on) would bind a SECOND `toggle-design-token-panel`
// listener — one dispatch would then count as two toggle intents and the panel
// would never open (see the double-registration guard comment in
// `../../design-token-panel-bootstrap.tsx`). This is the shape the
// "Mounting your own panel" reference section documents.
// `bootstrapDesignTokenPanel` no-ops
// during SSR (its own `typeof window === "undefined"` guard), so this
// component renders `null` on both sides, same as the package islands it
// mirrors. `displayName` matches the exported binding identifier so zfb's
// island scanner registers it, and the name is deliberately distinct from
// both package island names (`DesignTokenPanelBootstrap` /
// `ConfiguredDesignTokenPanelBootstrap`) so the marker/registry match in the
// build test is unambiguous.

import type { JSX } from "preact";
import { runDesignTokenPanelBootstrapOnce } from "@takazudo/zudo-doc/design-token-panel-bootstrap";
import { buildDesignTokenPanelConfig } from "./design-token-panel-config.js";

export function HostPanelBootstrap(): JSX.Element | null {
  runDesignTokenPanelBootstrapOnce(buildDesignTokenPanelConfig);
  return null;
}
HostPanelBootstrap.displayName = "HostPanelBootstrap";
