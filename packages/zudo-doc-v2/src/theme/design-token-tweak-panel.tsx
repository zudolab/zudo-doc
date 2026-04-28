// Design Token Tweak Panel — E5 framework primitives wrapper.
//
// Architecture
// ------------
//
// The host page (the doc layout) drops one `<DesignTokenTweakPanel />` into
// its DOM. That component is wrapped at the call-site by zfb's
// `<Island ssrFallback={null}>` — equivalent to Astro's `client:only="preact"`
// — so the heavy panel UI is never evaluated server-side. On hydration the
// island swaps in the real component, which:
//
//   1. Mounts the existing panel UI (ported from the original
//      `design-token-tweak/` directory in the host project) into the host
//      page so the user sees and interacts with it.
//   2. Renders a sandboxed `<iframe>` whose `srcdoc` echoes the host page's
//      relevant content. Token edits are forwarded to the iframe in real
//      time over the postMessage bridge defined in `./iframe-bridge`. The
//      iframe is the "preview canvas" — the host page itself is left
//      visually intact except for the panel chrome.
//
// Why a MutationObserver for the bridge?
// --------------------------------------
//
// The inner panel writes CSS-variable overrides directly to
// `document.documentElement.style` (palette colors, semantic tokens,
// spacing, font, size). Rather than reach inside the inner panel to
// retarget every write site, we observe the host root's `style` attribute
// and stream the diff to the iframe. That gives the iframe a live mirror
// of every override the panel makes, including ones triggered by future
// tabs we haven't ported yet — without forking the inner panel.
//
// zfb dependency
// --------------
//
// `@takazudo/zfb` is intentionally NOT in the v2 package's dependency tree
// for this E5 scaffold (the framework isn't published yet). The Island
// shape is shimmed via `declare module` below so this file type-checks in
// isolation; the real wiring happens at the consumer/integration level.

import { useEffect, useMemo, useRef, useState } from "react";
import type * as preact from "preact";
import InnerDesignTokenTweakPanel from "@/components/design-token-tweak";
import {
  BRIDGE_SOURCE,
  onIframeReady,
  sendApplyCssVars,
  sendClearCssVars,
  type CssVarPair,
} from "./iframe-bridge";
// `@takazudo/zfb` is shimmed in `_zfb-shim.d.ts` (declare module) so this
// import resolves at type-check time without adding the package to the v2
// dependency tree. See that shim for rationale.
import { Island } from "@takazudo/zfb";

/** CSS-variable name pattern we forward to the iframe — matches the design
 *  token convention used across both color and size families. */
const FORWARD_VAR_PREFIX = "--zd-";

/** Skim the host root's inline style for `--zd-*` overrides. */
function collectInlineCssVars(root: HTMLElement): CssVarPair[] {
  const out: CssVarPair[] = [];
  const decl = root.style;
  for (let i = 0; i < decl.length; i++) {
    const name = decl.item(i);
    if (!name.startsWith(FORWARD_VAR_PREFIX)) continue;
    const value = decl.getPropertyValue(name);
    if (value) out.push([name, value] as const);
  }
  return out;
}

/** Compute the set of names present in `prev` but absent from `next`. */
function namesDropped(prev: CssVarPair[], next: CssVarPair[]): string[] {
  const nextNames = new Set(next.map(([n]) => n));
  return prev.filter(([n]) => !nextNames.has(n)).map(([n]) => n);
}

interface DesignTokenTweakPanelInnerProps {
  /** Optional `srcdoc` content for the preview iframe; defaults to a minimal
   *  HTML shell that just installs the bridge receiver. Consumers wiring the
   *  panel into a real layout will pass the rendered page HTML. */
  iframeSrcDoc?: string;
}

/** Default iframe document — empty body + bridge receiver script. */
const DEFAULT_IFRAME_SRCDOC = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>html,body{margin:0;padding:0;background:var(--zd-bg,#fff);color:var(--zd-fg,#000);}</style>
</head>
<body>
<div id="zudo-doc-theme-preview-root"></div>
<script>
(function(){
var SOURCE=${JSON.stringify(BRIDGE_SOURCE)};
window.addEventListener("message",function(ev){
  var d=ev.data;
  if(!d||typeof d!=="object"||d.source!==SOURCE)return;
  var root=document.documentElement;
  if(d.type==="apply-css-vars"&&Array.isArray(d.vars)){
    for(var i=0;i<d.vars.length;i++){root.style.setProperty(d.vars[i][0],d.vars[i][1]);}
    return;
  }
  if(d.type==="clear-css-vars"&&Array.isArray(d.names)){
    for(var j=0;j<d.names.length;j++){root.style.removeProperty(d.names[j]);}
    return;
  }
});
if(window.parent&&window.parent!==window){
  window.parent.postMessage({source:SOURCE,type:"ready"},"*");
}
})();
</script>
</body>
</html>`;

function DesignTokenTweakPanelInner({
  iframeSrcDoc,
}: DesignTokenTweakPanelInnerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastVarsRef = useRef<CssVarPair[]>([]);
  const [iframeReady, setIframeReady] = useState(false);

  const srcDoc = useMemo(() => iframeSrcDoc ?? DEFAULT_IFRAME_SRCDOC, [iframeSrcDoc]);

  // Wait for the iframe to announce readiness before streaming initial state.
  useEffect(() => {
    const win = iframeRef.current?.contentWindow ?? null;
    const off = onIframeReady(win, () => setIframeReady(true));
    return off;
  }, []);

  // Mirror host root inline `--zd-*` overrides into the iframe in real time.
  // Note: this listener only mirrors changes made via inline-style on the
  // host `<html>` root. CSS variables set elsewhere (CSSOM rules, other
  // elements, animations) are intentionally NOT mirrored — the panel writes
  // exclusively to `documentElement.style` so this scope matches.
  useEffect(() => {
    if (!iframeReady) return;
    const root = document.documentElement;

    // Push the current state on first sync.
    const initial = collectInlineCssVars(root);
    if (initial.length > 0) {
      sendApplyCssVars(iframeRef.current, initial);
    }
    lastVarsRef.current = initial;

    // Debounce flushes to one per animation frame so a burst of mutations
    // (e.g. dragging a slider) collapses into a single postMessage hop.
    let rafId = 0;
    function scheduleFlush() {
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        const next = collectInlineCssVars(root);
        const dropped = namesDropped(lastVarsRef.current, next);
        if (dropped.length > 0) sendClearCssVars(iframeRef.current, dropped);
        if (next.length > 0) sendApplyCssVars(iframeRef.current, next);
        lastVarsRef.current = next;
      });
    }

    const observer = new MutationObserver(scheduleFlush);
    observer.observe(root, { attributes: true, attributeFilter: ["style"] });
    return () => {
      observer.disconnect();
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
    };
  }, [iframeReady]);

  return (
    <>
      {/* Off-screen preview iframe — kept in the DOM so the bridge stays
          live, but visually out of the user's way. Consumers can override
          this position via CSS. */}
      <iframe
        ref={iframeRef}
        title="Design token preview"
        srcDoc={srcDoc}
        // `sandbox` keeps the preview from running outside scripts but
        // still allows our bridge handler.
        sandbox="allow-scripts allow-same-origin"
        style={{
          position: "fixed",
          right: 0,
          bottom: 0,
          width: 1,
          height: 1,
          border: 0,
          opacity: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
        aria-hidden="true"
      />
      <InnerDesignTokenTweakPanel />
    </>
  );
}

/** Public component: zfb Island wrapper with `ssrFallback={null}` so the
 *  inner panel is fully client-only (Astro's `client:only="preact"` shape). */
export default function DesignTokenTweakPanel(
  props: DesignTokenTweakPanelInnerProps = {},
) {
  // The Island wrapper returns the SSR-skip element shape; cast at the
  // boundary so JSX consumers see a renderable child.
  const rendered = Island({
    ssrFallback: null,
    children: <DesignTokenTweakPanelInner {...props} />,
  });
  return rendered as unknown as preact.JSX.Element;
}

/** Re-export the inner component name so consumers can reach it directly
 *  for tests or storybook contexts (where the Island wrapper isn't
 *  meaningful). */
export { DesignTokenTweakPanelInner };
