/** @jsxRuntime automatic */
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { normalizeIslandData } from "../chrome/island-data.js";
// Props are data; the dependency below is a server boundary, never an Island target.
import type { ThemePackSwitcherProps } from "../theme-pack-switcher/index.js";

type ThemePackSwitcherComponent = (props: ThemePackSwitcherProps) => JSX.Element | null;

export interface ThemePackSwitcherIslandDeps {
  /** The `settings.themePackSwitcher` gate (default `false`). */
  themePackSwitcher: boolean;
  /**
   * Keep the launcher pending until the first mount effect. `false` disables
   * only zudo-doc's pending affordance; zfb's island hydration marker remains
   * owned by zfb.
   */
  pendingUntilHydrated?: boolean;
  /**
   * SSR props derived from `ctx.themePackRegistry` by
   * `chrome/derive.tsx` (ADR theme-packs.md Decision 7 "Switcher data
   * flow"). `null` means the registry was not threaded
   * (`themePackRegistry: null`) — the whole feature renders inert even when
   * the settings gate is on.
   */
  themePackSwitcherProps: ThemePackSwitcherProps | null;
  /** Fixed-target server boundary. Omitted means no mount even when enabled. */
  ThemePackSwitcher?: (props: ThemePackSwitcherProps) => JSX.Element | null;
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
  const pendingUntilHydrated = deps.pendingUntilHydrated ?? true;
  const transportProps = deps.themePackSwitcherProps === null
    ? null
    : normalizeIslandData(deps.themePackSwitcherProps);
  const ThemePackSwitcher = deps.ThemePackSwitcher as unknown as
    | ThemePackSwitcherComponent
    | undefined;

  function ThemePackSwitcherIsland(): JSX.Element | null {
    if (!deps.themePackSwitcher || transportProps === null || !ThemePackSwitcher) {
      return null;
    }

    return (
      <>
        <ThemePackSwitcher
          {...transportProps}
          pendingUntilHydrated={pendingUntilHydrated}
        />
      </>
    );
  }

  return ThemePackSwitcherIsland;
}
