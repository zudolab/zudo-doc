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
 * One tab panel. Always rendered with `hidden` so the page never paints
 * a flash of all-tabs-visible before the Tabs island activates the
 * default tab.
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
      hidden
    >
      {children}
    </div>
  );
}

export default TabItem;
