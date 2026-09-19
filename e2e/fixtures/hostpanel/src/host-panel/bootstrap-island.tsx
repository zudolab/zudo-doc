"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The hostpanel fixture's OWN design-token-panel island (#4310, epic #4309) —
// the live-browser counterpart of
// `packages/zudo-doc/src/__tests__/fixtures/route-injection/src/host-panel-bootstrap-island.tsx`.
//
// Goes through `runDesignTokenPanelBootstrapOnce`, never the raw
// `bootstrapDesignTokenPanel`: the call sits in the render body, so a re-render
// or a soft navigation (`dynamicPageTransition` is on here) would otherwise
// bootstrap a SECOND time, bind a SECOND `toggle-design-token-panel` listener,
// and make one trigger click count as two toggle intents — the panel would then
// never open.
//
// This island also owns the TRIGGER WIRING and the READY MARKER. With
// `designTokenPanel: false` the package emits neither its trigger nor its
// pre-hydration toggle shim, so there is no click queue to absorb a click that
// lands before hydration. The spec therefore needs an observable readiness
// condition instead of a sleep: `document.documentElement.dataset.hostPanelReady`
// is set only after the bootstrap ran AND the click handler is attached.
//
// The click handler is delegated on `document` rather than bound to the button
// node: zfb's SPA transition swaps the body, so a node-bound listener would be
// lost on the first soft navigation while this island's effect does not re-run.

import type { JSX } from "preact";
import { useEffect } from "preact/hooks";
import { runDesignTokenPanelBootstrapOnce } from "@takazudo/zudo-doc/design-token-panel-bootstrap";
import { buildDesignTokenPanelConfig } from "./design-token-panel-config.js";
import { HOST_TOKEN_TRIGGER_ID } from "./trigger.js";

/**
 * Marker attribute `e2e/hostpanel-design-token-panel.spec.ts` waits on:
 * `<html data-host-panel-ready="1">`. Deliberately not exported — the spec lives
 * in a separate TS project and asserts the literal.
 */
const HOST_PANEL_READY_ATTRIBUTE = "data-host-panel-ready";

const TOGGLE_EVENT = "toggle-design-token-panel";

export function HostPanelBootstrap(): JSX.Element | null {
  // No-ops during SSR via its own `typeof window === "undefined"` guard, so
  // this component renders `null` on both sides — same as the package islands.
  runDesignTokenPanelBootstrapOnce(buildDesignTokenPanelConfig);

  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(`#${HOST_TOKEN_TRIGGER_ID}`)) return;
      window.dispatchEvent(new CustomEvent(TOGGLE_EVENT));
    };
    document.addEventListener("click", onClick);
    document.documentElement.setAttribute(HOST_PANEL_READY_ATTRIBUTE, "1");
    return () => {
      document.removeEventListener("click", onClick);
      document.documentElement.removeAttribute(HOST_PANEL_READY_ATTRIBUTE);
    };
  }, []);

  return null;
}
HostPanelBootstrap.displayName = "HostPanelBootstrap";
