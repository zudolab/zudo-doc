/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import type { FactoryComponent } from "../factory-context/index.js";
// Type-only — erased at build; the REAL component arrives through
// `deps.ThemePackSwitcher` (statically imported by `chrome/derive.tsx`, the
// scanner-reachability chain — see the note below).
import type { ThemePackSwitcherProps } from "../theme-pack-switcher/index.js";

type ThemePackSwitcherComponent = (props: ThemePackSwitcherProps) => JSX.Element | null;

export interface ThemePackSwitcherIslandDeps {
  /** The `settings.themePackSwitcher` gate (default `false`). */
  themePackSwitcher: boolean;
  /**
   * SSR props derived from `ctx.themePackRegistry` by
   * `chrome/derive.tsx` (ADR theme-packs.md Decision 7 "Switcher data
   * flow"). `null` means the registry was not threaded
   * (`themePackRegistry: null`) — the whole feature renders inert even when
   * the settings gate is on.
   */
  themePackSwitcherProps: ThemePackSwitcherProps | null;
  /**
   * The real `ThemePackSwitcher` island component. Injected (not imported
   * here) mirroring `design-token-panel-island.tsx`'s shape: the props above
   * only exist on the chrome-derive path, so `chrome/derive.tsx` supplies the
   * statically imported package component as the default for every
   * `createChrome` consumer (route → chrome → derive → component is the
   * island-scanner reachability chain — the #2480 lesson). Omitted means no
   * island mounts even when the gate is on — a safe no-op, not a crash.
   */
  ThemePackSwitcher?: FactoryComponent;
}

/**
 * Bind the settings gate + the SSR-derived props to the theme-pack switcher
 * flyout island mount (`Island({ when: "load" })` — the island SSRs its
 * launcher markup and hydrates at load; its serializable props ride the
 * marker's `data-props` JSON). Kept separate from the rest of the package
 * body-end islands so a host BodyEndIslands override can be composed with
 * this package-owned mount without duplicating the other package defaults
 * (the `design-token-panel-island.tsx` pattern).
 */
export function createThemePackSwitcherIsland(
  deps: ThemePackSwitcherIslandDeps,
): () => JSX.Element | null {
  const ThemePackSwitcher = deps.ThemePackSwitcher as unknown as
    | ThemePackSwitcherComponent
    | undefined;

  function ThemePackSwitcherIsland(): JSX.Element | null {
    if (!deps.themePackSwitcher || deps.themePackSwitcherProps === null || !ThemePackSwitcher) {
      return null;
    }

    return (
      <>
        {
          Island({
            when: "load",
            children: <ThemePackSwitcher {...deps.themePackSwitcherProps} />,
          }) as unknown as VNode
        }
      </>
    );
  }

  return ThemePackSwitcherIsland;
}
