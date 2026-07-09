/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// doc-body-end-islands — the PACKAGE-DEFAULT body-end islands for package-owned
// routes (#2406 / #2401(c)).
//
// Package-owned routes (404 / index / locale-index / docs / versions / tags)
// wire their `bodyEndComponents` slot through `routes/_chrome.tsx`. Before this
// module they used a no-op `BodyEndIslandsStub` that rendered `<></>`, so the
// island markers for AiChatModal / ImageEnlarge / MermaidEnlarge never reached
// the DOM — image-enlarge / mermaid-enlarge / AI-chat were dead on `/404` and
// every package route. This factory reconstructs the PACKAGE-ISLAND subset of
// the host's `pages/lib/_body-end-islands.tsx` from the serializable `settings`
// flags the route-context virtual module already carries.
//
// SCOPE — package islands + chrome (gated on serializable settings):
//   - aiAssistant           → `<h2 sr-only>AI Assistant</h2>` + skip-ssr AiChatModal
//   - imageEnlarge          → idle skip-ssr ImageEnlarge   (SSR dialog-shell fallback)
//   - mermaid               → idle skip-ssr MermaidEnlarge (SSR dialog-shell fallback)
//   - dynamicPageTransition → pure-SSR <PageLoadingOverlay/> (zudolab/zudo-doc#2482)
//   - designTokenPanel      → load (non-skip-ssr*) DesignTokenPanelBootstrap (see below, #2658)
// It deliberately OMITS the host-owned `ClientRouterBootstrap`: it imports from
// `@/components/*` and is NOT reconstructable from package settings. The page-
// loading overlay, by contrast, is a pure PACKAGE component (`../page-loading`)
// with no host coupling, so it CAN be mounted here — and package-owned routes
// already activate `<ClientRouter/>` via `enableClientRouter` on the same flag,
// so the overlay only needed its markup mount (zudolab/zudo-doc#2482, the
// package-owned-routes analog of the #1541 host-mount decision).
//
// `designTokenPanel` (#2658) is DIFFERENT from the AiChatModal/ImageEnlarge/
// MermaidEnlarge trio above: the real `DesignTokenPanelBootstrap` component is
// itself a package component (`@takazudo/zudo-doc/design-token-panel-bootstrap`,
// self-contained via the `virtual:zudo-doc-design-token-panel-config` virtual
// module), but importing it here directly would leak that virtual-module
// dependency into `createBodyEndIslands`'s generic, routes-plugin-independent
// reachability graph (this factory is also called by `chrome/derive.tsx` for a
// FUTURE host calling `createChrome` directly, without `packageOwnedRoutes`).
// So it is injected as an explicit `DesignTokenPanelBootstrap` dependency
// (`BodyEndIslandsDeps`) instead of imported at module top-level — `_chrome.tsx`
// is the ONE caller that both statically imports the real component (so the
// island scanner walks route → _chrome → component, mirroring the DocHistory
// #2480 chain) AND is only ever reached when the routes plugin (and therefore
// the virtual module) is active. See `../design-token-panel-bootstrap.tsx` for
// the full coupling note. *Not skip-ssr in the zfb-marker sense — it renders
// `null` on both SSR and client, so it uses `Island({ when })` with no
// `ssrFallback` (matches `ClientRouterBootstrap`'s host-side precedent), which
// zfb marks `data-zfb-island` (no `-skip-ssr` suffix).
//
// WHY A FACTORY (and not a component that imports `settings` itself): this
// module compiles to `dist/`, which a published consumer resolves INSIDE
// node_modules. zfb's esbuild bundler does NOT run the route-context virtual-
// module resolver on imports whose realpath is under node_modules (the S1
// #2370 gap; the routes plugin stages only `routes-src/` outside node_modules,
// not `dist/`). So this module must NOT import `routes/_context` — its
// transitive `virtual:zudo-doc-route-context` import would dangle. Instead
// `_chrome.tsx` (which DOES read the staged virtual-module `settings`) injects
// the flags here, mirroring every other `createX({ settings, … })` factory in
// that file.
//
// ISLAND-SCANNER / displayName: the real island components are imported at
// module top-level so the scanner walks route → _chrome → here → component.
// AiChatModal / ImageEnlarge / MermaidEnlarge each pin `displayName` internally
// (src/{ai-chat-modal,image-enlarge,mermaid-enlarge}), so zfb's
// `captureComponentName` emits a stable `data-zfb-island-skip-ssr="<name>"`
// marker — no call-site pinning needed here. `DesignTokenPanelBootstrap` is
// NOT imported at this module's top level (see the note above) — it arrives
// as an already-real component via `deps.DesignTokenPanelBootstrap`, pinned by
// its own module (`../design-token-panel-bootstrap.tsx`).

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { AiChatModal } from "../ai-chat-modal/index.js";
import { ImageEnlarge, ImageEnlargeSsrFallback } from "../image-enlarge/index.js";
import { MermaidEnlarge, MermaidEnlargeSsrFallback } from "../mermaid-enlarge/index.js";
// Named export (`page-loading/index.ts` re-exports `{ default as PageLoadingOverlay }`).
import { PageLoadingOverlay } from "../page-loading/index.js";
// Type-only — erased at build, so importing it does not pull `factory-context`'s
// (node-free, but otherwise unrelated) runtime graph into this module.
import type { FactoryComponent } from "../factory-context/index.js";

/** Default sr-only label rendered as the AiChatModal SSR fallback. Mirrors the
 *  host helper's default verbatim so assistive tech can discover the chat
 *  entrypoint in static HTML before JS hydration. English-only; pass
 *  `aiChatBodyLabel` to localise. */
const DEFAULT_AI_CHAT_BODY_LABEL = "Ask a question about the documentation.";

/**
 * SSR-emitted inline script that acts as a pre-hydration shim for the
 * `toggle-design-token-panel` window event (mirrors the host's
 * `pages/lib/_body-end-islands.tsx` verbatim, zudolab/zudo-doc#1627 Part B).
 * Because the `DesignTokenPanelBootstrap` Island hydrates on `when: "load"`
 * (not immediately), zdtp's real `toggle-design-token-panel` listener is not
 * yet installed when the user clicks the header palette button
 * (`header/header.tsx`'s `trigger:design-token-panel` item, already
 * package-owned and gated on this same `settings.designTokenPanel` flag).
 * This shim:
 *
 *  1. Records the first (and only meaningful) click as a boolean flag.
 *  2. Exposes `window.__zdtpReadyClicks` so the bootstrap Island can drain the
 *     queue and re-dispatch a single event once the real listener is live
 *     (`bootstrapDesignTokenPanel` calls this — see `../design-token-panel-bootstrap.tsx`).
 *  3. Guards against double-installation across any re-evaluation path (SPA
 *     body swap, HMR, etc.) via `__zdtpToggleShimInstalled`.
 */
const ZDTP_TOGGLE_SHIM_SRC = `(function(){
if(window.__zdtpToggleShimInstalled)return;
window.__zdtpToggleShimInstalled=true;
var pending=false;
function shim(){pending=true;}
window.addEventListener('toggle-design-token-panel',shim);
window.__zdtpReadyClicks=function(){
window.removeEventListener('toggle-design-token-panel',shim);
delete window.__zdtpReadyClicks;
if(pending){pending=false;window.dispatchEvent(new CustomEvent('toggle-design-token-panel'));}
};
})();`;

/** The `settings` subset this factory reads — the four package-island flags.
 *  A structural subset so the host can pass its full `Settings` object. */
export interface BodyEndIslandsSettings {
  aiAssistant: boolean;
  imageEnlarge: boolean;
  mermaid: boolean;
  /** Gates the pure-SSR `<PageLoadingOverlay/>` mount (zudolab/zudo-doc#2482),
   *  mirroring the host gate and `enableClientRouter`'s on package-owned routes.
   *  Optional so adding it is NOT a breaking change for external callers that
   *  construct this documented subset — this is an exported package subpath API.
   *  `undefined` is treated as `false` (no overlay) at the mount site, preserving
   *  pre-#2482 behavior; internal callers always pass the full `Settings`. */
  dynamicPageTransition?: boolean;
  /** Gates the `DesignTokenPanelBootstrap` island mount (#2658). Optional for
   *  the same external-caller-compat reason as `dynamicPageTransition` above.
   *  `undefined` is treated as `false` (no panel island). Even when `true`,
   *  nothing mounts unless `deps.DesignTokenPanelBootstrap` was also supplied
   *  — see {@link BodyEndIslandsDeps}. */
  designTokenPanel?: boolean;
}

/** Dependencies injected by `_chrome.tsx` (carries the virtual-module settings). */
export interface BodyEndIslandsDeps {
  settings: BodyEndIslandsSettings;
  /**
   * The real `DesignTokenPanelBootstrap` component (#2658). Genuinely
   * host-bound — see the module header note above for why it is NOT imported
   * directly here. `_chrome.tsx` supplies
   * `@takazudo/zudo-doc/design-token-panel-bootstrap`'s `DesignTokenPanelBootstrap`;
   * omitted (e.g. a bare `createBodyEndIslands({ settings })` call, as this
   * factory's own unit tests do) means no panel island mounts even when
   * `settings.designTokenPanel` is `true` — a safe no-op, not a crash.
   */
  DesignTokenPanelBootstrap?: FactoryComponent;
}

/** Props for the produced `BodyEndIslands` component. */
export interface BodyEndIslandsProps {
  /** Base path the AI chat modal uses to construct API URLs. */
  basePath: string;
  /**
   * Sr-only label rendered as the AiChatModal SSR fallback. Defaults to the
   * English string; pass a locale-translated string for non-default locales so
   * screen readers announce the chat entrypoint correctly before hydration.
   */
  aiChatBodyLabel?: string;
}

/**
 * Build the package-default `BodyEndIslands` component bound to the host's
 * serializable `settings` flags. The produced component matches the
 * `createDocBodyEnd` `BodyEndIslands` slot contract
 * (`(props: { basePath: string }) => JSX.Element`).
 */
/** Concrete zero-prop shape of the real `DesignTokenPanelBootstrap` — narrower
 *  than the structural `FactoryComponent` so it can be used as JSX directly
 *  (mirrors `doc-history-area/index.tsx`'s `DocHistory` cast). */
type DesignTokenPanelBootstrapComponent = () => JSX.Element | null;

export function createBodyEndIslands(
  deps: BodyEndIslandsDeps,
): (props: BodyEndIslandsProps) => JSX.Element {
  const { settings } = deps;
  const DesignTokenPanelBootstrap = deps.DesignTokenPanelBootstrap as unknown as
    | DesignTokenPanelBootstrapComponent
    | undefined;

  function BodyEndIslands({
    basePath,
    aiChatBodyLabel = DEFAULT_AI_CHAT_BODY_LABEL,
  }: BodyEndIslandsProps): JSX.Element {
    // Gated on `settings.aiAssistant` (zudolab/zudo-doc#2058): when off, neither
    // the AiChatModal island marker nor the sr-only "AI Assistant" landmark
    // heading reach the SSG output. The marker is ALWAYS emitted when the flag
    // is on (skip-ssr Island wrapping the real AiChatModal) so zfb's island
    // scanner registers the constructor and does not strip the bundle. The
    // sr-only <p> fallback keeps the body label in static HTML for screen
    // readers before hydration.
    const aiAssistant = settings.aiAssistant ? (
      <>
        <h2 class="sr-only">AI Assistant</h2>
        {
          Island({
            ssrFallback: <p class="sr-only">{aiChatBodyLabel}</p>,
            children: <AiChatModal basePath={basePath} />,
          }) as unknown as VNode
        }
      </>
    ) : null;

    // Gated on `settings.imageEnlarge`. The SSR fallback is the empty, closed
    // `<dialog class="zd-enlarge-dialog …">` shell so the dist HTML carries one
    // dialog from the start; hydration (when="idle") swaps in the real
    // ImageEnlarge component.
    const imageEnlarge = settings.imageEnlarge
      ? (Island({
          when: "idle",
          ssrFallback: <ImageEnlargeSsrFallback />,
          children: <ImageEnlarge />,
        }) as unknown as VNode)
      : null;

    // Gated on `settings.mermaid`. Mirrors imageEnlarge: empty closed
    // `<dialog class="zd-mermaid-dialog …">` SSR fallback; hydration injects the
    // enlarge button into each rendered diagram container.
    const mermaidEnlarge = settings.mermaid
      ? (Island({
          when: "idle",
          ssrFallback: <MermaidEnlargeSsrFallback />,
          children: <MermaidEnlarge />,
        }) as unknown as VNode)
      : null;

    // Gated on `settings.designTokenPanel` (#2658) AND on `DesignTokenPanelBootstrap`
    // having been injected (see `BodyEndIslandsDeps`) — an omitted dep is a safe
    // no-op, not a crash. Hydrates on `when: "load"` so `configurePanel()` runs
    // as early as possible and the `toggle-design-token-panel` window listener
    // is registered before the user can click the header trigger. No
    // `ssrFallback`: the component renders nothing on either side, so this uses
    // the plain (non-skip-ssr) `Island` form, matching the host's
    // `ClientRouterBootstrap` precedent — `data-zfb-island="DesignTokenPanelBootstrap"`
    // (not the `-skip-ssr` variant AiChatModal/ImageEnlarge/MermaidEnlarge use,
    // since those DO have real SSR fallback markup).
    //
    // The inline <script> emitted alongside the Island is the pre-hydration
    // toggle shim (zudolab/zudo-doc#1627 Part B, see `ZDTP_TOGGLE_SHIM_SRC`
    // above). It captures the first click as a boolean flag and exposes
    // `window.__zdtpReadyClicks` so the bootstrap module can drain and
    // re-dispatch once the real zdtp listener is registered.
    const designTokenPanelBootstrap =
      settings.designTokenPanel && DesignTokenPanelBootstrap
        ? (
            <>
              <script dangerouslySetInnerHTML={{ __html: ZDTP_TOGGLE_SHIM_SRC }} />
              {
                Island({
                  when: "load",
                  children: <DesignTokenPanelBootstrap />,
                }) as unknown as VNode
              }
            </>
          )
        : null;

    return (
      <>
        {/* Pure SSR — no <Island> wrap. Gated on `settings.dynamicPageTransition`
            (zudolab/zudo-doc#2482), mirroring the host mount in
            `pages/lib/_body-end-islands.tsx`: package-owned routes had the overlay
            CSS but nothing mounted its markup, so SPA transitions showed no
            loading spinner. The overlay self-wires its show/hide on
            zfb:before-preparation / zfb:after-swap via an inline bootstrap script
            and is intentionally not hydrated. No ClientRouterBootstrap needed
            here — package routes already activate <ClientRouter/> through
            `enableClientRouter` on this same flag. */}
        {settings.dynamicPageTransition ? <PageLoadingOverlay /> : null}
        {designTokenPanelBootstrap}
        {aiAssistant}
        {imageEnlarge}
        {mermaidEnlarge}
      </>
    );
  }

  return BodyEndIslands;
}
