/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import type { FactoryComponent } from "../factory-context/index.js";

/**
 * SSR-emitted pre-hydration shim for the design-token panel toggle. The
 * package-owned bootstrap drains this queue once its load-time island runs.
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

type DesignTokenPanelBootstrapComponent = () => JSX.Element | null;

export interface DesignTokenPanelIslandDeps {
  designTokenPanel: boolean | undefined;
  DesignTokenPanelBootstrap?: FactoryComponent;
}

/**
 * Bind the current settings gate to the package-owned bootstrap island.
 * Kept separate from the rest of the package body-end islands so a host
 * BodyEndIslands override can be composed with this package-owned marker
 * without duplicating the other package defaults.
 */
export function createDesignTokenPanelIsland(
  deps: DesignTokenPanelIslandDeps,
): () => JSX.Element | null {
  const DesignTokenPanelBootstrap = deps.DesignTokenPanelBootstrap as unknown as
    | DesignTokenPanelBootstrapComponent
    | undefined;

  function DesignTokenPanelIsland(): JSX.Element | null {
    if (!deps.designTokenPanel || !DesignTokenPanelBootstrap) return null;

    return (
      <>
        <script dangerouslySetInnerHTML={{ __html: ZDTP_TOGGLE_SHIM_SRC }} />
        {
          Island({
            when: "load",
            children: <DesignTokenPanelBootstrap />,
          }) as unknown as VNode
        }
      </>
    );
  }

  return DesignTokenPanelIsland;
}
