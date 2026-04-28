// Public entry point for the SSR-skip framework wrappers.
//
// Doc pages import these wrappers in place of the legacy Astro
// `client:*` directives that pointed at the underlying Preact
// components. Each wrapper emits a zfb SSR-skip placeholder
// (`data-zfb-island-skip-ssr="<name>"`) so the heavy / browser-only
// component is not evaluated server-side; the hydration runtime swaps
// the placeholder for the real component on the client.

export { AiChatModalIsland, type AiChatModalIslandProps } from "./ai-chat-modal-island.js";
export { ImageEnlargeIsland, type ImageEnlargeIslandProps } from "./image-enlarge-island.js";
export {
  DesignTokenTweakPanelIsland,
  type DesignTokenTweakPanelIslandProps,
} from "./design-token-tweak-panel-island.js";
export { MockInitIsland, type MockInitIslandProps } from "./mock-init-island.js";

export type { IslandWhen, SsrSkipFallbackProps } from "./types.js";
