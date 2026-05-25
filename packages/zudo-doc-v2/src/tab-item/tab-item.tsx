/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// JSX port of src/components/tab-item.astro.
//
// Visual wrapper for one tab panel inside a Tabs group. Server-rendered,
// no hydration. The companion Tabs island reads `data-tab-value` /
// `data-tab-label` / `data-tab-default` to wire interactivity, so the
// attribute shape here must mirror the Astro original byte-for-byte.

import type { ComponentChildren } from "preact";

export interface TabItemProps {
  /** Human-readable label rendered by the parent Tabs trigger row. */
  label: string;
  /**
   * Optional stable value for the tab. Falls back to `label` when
   * omitted, matching the Astro original's `value ?? label`.
   */
  value?: string;
  /**
   * When true, this panel is the initially-active one. Encoded as the
   * empty-string `data-tab-default` attribute so plain attribute
   * selectors (`[data-tab-default]`) still match.
   */
  default?: boolean;
  /** Panel body. */
  children?: ComponentChildren;
}

/**
 * One tab panel.
 *
 * Wave 11 (zudolab/zudo-doc#1355): the default panel is rendered
 * **without** the `hidden` attribute so the SSR HTML already shows the
 * correct active panel before any JS runs. Non-default panels keep
 * `hidden`. This avoids the post-Wave-10 regression where the tabs
 * init script could land after first paint and flash an empty tab
 * group; it also gives the no-JS path a usable default tab.
 *
 * The companion `TabsInit` script remains the source of truth at
 * runtime — it re-derives the active tab from `localStorage` and
 * `[data-tab-default]` and reapplies `hidden` / `aria-selected` so
 * the SSR-rendered defaults survive group sync and View Transitions.
 */
export function TabItem({
  label,
  value,
  default: isDefault,
  children,
}: TabItemProps) {
  return (
    <div
      class="tab-panel"
      role="tabpanel"
      data-tab-value={value ?? label}
      data-tab-label={label}
      // `data-tab-default={undefined}` omits the attribute entirely,
      // matching the Astro template's conditional spread.
      data-tab-default={isDefault ? "" : undefined}
      // Render `hidden` only on non-default panels so the SSR markup
      // shows the active panel immediately (no JS-required flash).
      hidden={isDefault ? undefined : true}
    >
      {children}
    </div>
  );
}

export default TabItem;
