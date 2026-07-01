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
// It deliberately OMITS the host-owned bootstraps that helper also wires
// (`ClientRouterBootstrap`, `DesignTokenPanelBootstrap`): those import from
// `@/components/*` and are NOT reconstructable from package settings. The page-
// loading overlay, by contrast, is a pure PACKAGE component (`../page-loading`)
// with no host coupling, so it CAN be mounted here — and package-owned routes
// already activate `<ClientRouter/>` via `enableClientRouter` on the same flag,
// so the overlay only needed its markup mount (zudolab/zudo-doc#2482, the
// package-owned-routes analog of the #1541 host-mount decision).
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
// marker — no call-site pinning needed here.

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { AiChatModal } from "../ai-chat-modal/index.js";
import { ImageEnlarge, ImageEnlargeSsrFallback } from "../image-enlarge/index.js";
import { MermaidEnlarge, MermaidEnlargeSsrFallback } from "../mermaid-enlarge/index.js";
// Named export (`page-loading/index.ts` re-exports `{ default as PageLoadingOverlay }`).
import { PageLoadingOverlay } from "../page-loading/index.js";

/** Default sr-only label rendered as the AiChatModal SSR fallback. Mirrors the
 *  host helper's default verbatim so assistive tech can discover the chat
 *  entrypoint in static HTML before JS hydration. English-only; pass
 *  `aiChatBodyLabel` to localise. */
const DEFAULT_AI_CHAT_BODY_LABEL = "Ask a question about the documentation.";

/** The `settings` subset this factory reads — the three package-island flags.
 *  A structural subset so the host can pass its full `Settings` object. */
export interface BodyEndIslandsSettings {
  aiAssistant: boolean;
  imageEnlarge: boolean;
  mermaid: boolean;
  /** Gates the pure-SSR `<PageLoadingOverlay/>` mount (zudolab/zudo-doc#2482),
   *  mirroring the host gate and `enableClientRouter`'s on package-owned routes. */
  dynamicPageTransition: boolean;
}

/** Dependencies injected by `_chrome.tsx` (carries the virtual-module settings). */
export interface BodyEndIslandsDeps {
  settings: BodyEndIslandsSettings;
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
export function createBodyEndIslands(
  deps: BodyEndIslandsDeps,
): (props: BodyEndIslandsProps) => JSX.Element {
  const { settings } = deps;

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
        {aiAssistant}
        {imageEnlarge}
        {mermaidEnlarge}
      </>
    );
  }

  return BodyEndIslands;
}
