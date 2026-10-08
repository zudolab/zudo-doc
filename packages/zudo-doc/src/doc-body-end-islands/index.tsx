/** @jsxRuntime automatic */
// Package-default body-end views. Settings and ordinary server dependencies
// flow through this factory; concrete client identities stay at fixed Island
// boundaries. DesignTokenPanelBootstrap and ThemePackSwitcher dependencies
// are SERVER boundary components in v6, returning Fragment-wrapped Islands.
// chrome/derive supplies package defaults; routes/_chrome supplies the configured
// panel boundary and preserves explicit host precedence. These functions never
// cross island JSON transport. Missing dependencies render no feature/shim.
// The host-owned ClientRouterBootstrap remains outside this default view.
// Settings arrive through the context rather than virtual imports because this
// compiled package graph must also work outside staged package routes.

import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { Island } from "@takazudo/zfb";
import { AiChatModal } from "../ai-chat-modal/index.js";
import { ImageEnlarge } from "../image-enlarge/index.js";
import { ImageEnlargeSsrFallback } from "../image-enlarge/ssr-fallback.js";
import { MermaidEnlarge } from "../mermaid-enlarge/index.js";
import { MermaidEnlargeSsrFallback } from "../mermaid-enlarge/ssr-fallback.js";
import { FindInPageInit } from "../find-in-page/index.js";
// Named export (`page-loading/index.ts` re-exports `{ default as PageLoadingOverlay }`).
import { PageLoadingOverlay } from "../page-loading/index.js";
import { createDesignTokenPanelIsland } from "./design-token-panel-island.js";
import { createThemePackSwitcherIsland } from "./theme-pack-switcher-island.js";
// Type-only — erased at build, so importing it does not pull `factory-context`'s
// (node-free, but otherwise unrelated) runtime graph into this module.
import type { FactoryComponent } from "../factory-context/index.js";
import type { ThemePackSwitcherProps } from "../theme-pack-switcher/index.js";

/** Default sr-only label rendered as the AiChatModal SSR fallback. Mirrors the
 *  host helper's default verbatim so assistive tech can discover the chat
 *  entrypoint in static HTML before JS hydration. English-only; pass
 *  `aiChatBodyLabel` to localise. */
const DEFAULT_AI_CHAT_BODY_LABEL = "Ask a question about the documentation.";

/** The `settings` subset this factory reads — the package feature flags.
 *  A structural subset so the host can pass its full `Settings` object. */
export interface BodyEndIslandsSettings {
  aiAssistant: boolean;
  imageEnlarge: boolean;
  mermaid: boolean;
  /** Gates the pure-SSR `<PageLoadingOverlay/>` mount (zudolab/zudo-doc#2482),
   *  mirroring the host gate and `enableClientRouter` on package-owned routes. */
  dynamicPageTransition: boolean;
  /** Gates the `DesignTokenPanelBootstrap` island mount (#2658). Even when
   *  `true`, nothing mounts unless `deps.DesignTokenPanelBootstrap` was also
   *  supplied — see {@link BodyEndIslandsDeps}. */
  designTokenPanel: boolean;
  /**
   * Gates the `FindInPageInit` island mount (zudolab/zudo-doc#2689).
   * Controls the PACKAGE-DEFAULT `BodyEndIslands` slot only — a host that
   * overrides the `BodyEndIslands` chrome binding must mount `FindInPageInit`
   * itself.
   */
  findInPage: boolean;
  /**
   * Gates the `ThemePackSwitcher` flyout island mount (ADR
   * `docs/adr/theme-packs.md` Decision 7; #2821). Optional — the field is
   * optional on the host `Settings` census too (default `false`). Even when
   * `true`, nothing mounts unless `deps.themePackSwitcherProps` AND
   * `deps.ThemePackSwitcher` were also supplied — see
   * {@link BodyEndIslandsDeps}.
   */
  themePackSwitcher?: boolean;
}

/** Dependencies injected by `_chrome.tsx` (carries the virtual-module settings). */
export interface BodyEndIslandsDeps {
  settings: BodyEndIslandsSettings;
  /** Server boundary for a fixed panel client target. Omitted means no mount or shim. */
  DesignTokenPanelBootstrap?: FactoryComponent;
  /**
   * SSR props for the theme-pack switcher flyout (#2821) — derived from
   * `ctx.themePackRegistry` by `chrome/derive.tsx` (only the chrome-derive
   * path knows the registry). `null`/omitted renders the feature inert even
   * when `settings.themePackSwitcher` is `true`.
   */
  themePackSwitcherProps?: ThemePackSwitcherProps | null;
  /**
   * Keep the theme-pack launcher pending until its first mount effect. The
   * package chrome path pins this to `true`; direct factory consumers may opt
   * out of zudo-doc's pending affordance without changing zfb's marker.
   */
  pendingUntilHydrated?: boolean;
  /** Server boundary accepting the serializable switcher props. Omitted means no mount. */
  ThemePackSwitcher?: (props: ThemePackSwitcherProps) => JSX.Element | null;
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
  /** Force the ImageEnlarge island for a page-owned enlargeable image. */
  forceImageEnlarge?: boolean;
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
  const DesignTokenPanelIsland = createDesignTokenPanelIsland({
    designTokenPanel: settings.designTokenPanel,
    DesignTokenPanelBootstrap: deps.DesignTokenPanelBootstrap,
  });
  const ThemePackSwitcherIsland = createThemePackSwitcherIsland({
    themePackSwitcher: settings.themePackSwitcher === true,
    themePackSwitcherProps: deps.themePackSwitcherProps ?? null,
    ThemePackSwitcher: deps.ThemePackSwitcher,
    pendingUntilHydrated: deps.pendingUntilHydrated ?? true,
  });

  function BodyEndIslands({
    basePath,
    aiChatBodyLabel = DEFAULT_AI_CHAT_BODY_LABEL,
    forceImageEnlarge = false,
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
          })
        }
      </>
    ) : null;

    // Gated on `settings.imageEnlarge`. The SSR fallback is the empty, closed
    // `<dialog class="zd-enlarge-dialog …">` shell so the dist HTML carries one
    // dialog from the start; hydration (when="idle") swaps in the real
    // ImageEnlarge component.
    const imageEnlarge = settings.imageEnlarge || forceImageEnlarge
      ? (Island({
          when: "idle",
          ssrFallback: <ImageEnlargeSsrFallback />,
          children: <ImageEnlarge />,
        }))
      : null;

    // Gated on `settings.mermaid`. Mirrors imageEnlarge: empty closed
    // `<dialog class="zd-mermaid-dialog …">` SSR fallback; hydration injects the
    // enlarge button into each rendered diagram container.
    const mermaidEnlarge = settings.mermaid
      ? (Island({
          when: "idle",
          ssrFallback: <MermaidEnlargeSsrFallback />,
          children: <MermaidEnlarge />,
        }))
      : null;

    // Gated on `settings.findInPage` (zudolab/zudo-doc#2689). This gate
    // controls the PACKAGE-DEFAULT `BodyEndIslands` slot ONLY — a host that
    // overrides the `BodyEndIslands` chrome binding must mount
    // `FindInPageInit` itself. Mirrors `designTokenPanelBootstrap` above:
    // `when: "load"` so the Cmd/Ctrl+F listener is registered as early as
    // possible, no `ssrFallback` (the component renders nothing on either
    // side — it self-gates on `window.__TAURI_INTERNALS__` — so this is the
    // plain non-skip-ssr `Island` form, `data-zfb-island="FindInPageInit"`).
    const findInPageInit = settings.findInPage
      ? (Island({
          when: "load",
          children: <FindInPageInit />,
        }))
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
        {/* Package-owned, settings-gated load-time island. Its factory keeps
            this same mount available when deriveBodyEndIslands composes a
            host BodyEndIslands override instead of using this default. */}
        <DesignTokenPanelIsland />
        {/* Package-owned, settings-gated load-time island (#2821) — same
            composition contract as DesignTokenPanelIsland above. */}
        <ThemePackSwitcherIsland />
        {findInPageInit}
        {aiAssistant}
        {imageEnlarge}
        {mermaidEnlarge}
      </>
    );
  }

  return BodyEndIslands;
}
