/** @jsxRuntime automatic */
// JSX port of the legacy `tabs` component.
//
// The original component rendered:
//   1. A container `<div data-tabs data-group-id={groupId}>`.
//   2. An empty `<div class="tabs-nav">` — the tab buttons were created
//      imperatively by the companion `tabs-init` script at runtime.
//   3. A `<div class="tabs-content"><slot/></div>` holding the `<TabItem>`
//      panels.
//
// This JSX port takes a different (more SSR-friendly) approach:
//   - It uses zudo-react's `flattenChildren` to discover `<TabItem>` children
//     server-side and renders the nav buttons statically in the HTML.
//   - The companion `<TabsInit>` component (see tabs-init.tsx) still needs
//     to be included in the layout; its script activates the correct tab
//     and wires click handlers — but it no longer has to create buttons.
//
// Children that are NOT `<TabItem>` elements are rendered into the content
// area unchanged, so mixed content (e.g. a heading above a tab set) works.

import { h, flattenChildren } from "@takazudo/zfb/zudo-react";
import type { Child, Description } from "@takazudo/zfb/zudo-react";
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { TabItem } from "../tab-item/tab-item.js";
import type { TabItemProps } from "../tab-item/tab-item.js";

const BASE_BTN_CLASS =
  "px-hsp-lg py-vsp-xs text-small font-medium border-b-[5px] -mb-px transition-colors duration-0";
/**
 * Wave 11 (zudolab/zudo-doc#1355): the default tab's button now ships
 * with active styles and `aria-selected="true"` straight from SSR — see
 * the `Tabs` body for the per-button selection. Non-default buttons
 * keep the inactive class. The companion TabsInit script can still
 * re-derive the active tab (e.g. from localStorage group sync) and
 * reapply both classes; the styles below stay in lockstep with
 * `tabs-init-script.ts`.
 */
const ACTIVE_BTN_CLASS = `${BASE_BTN_CLASS} text-accent border-accent`;
const INACTIVE_BTN_CLASS = `${BASE_BTN_CLASS} text-muted border-transparent hover:text-fg`;

export interface TabsProps {
  /**
   * When set, clicking a tab in this group persists the chosen value to
   * `localStorage` under `tabs-group-{groupId}` and syncs all other
   * containers that share the same `groupId`.
   */
  groupId?: string;
  /** `<TabItem>` children (and any other content). */
  children?: Child;
}

/**
 * Server-rendered tab container — JSX port of the legacy `tabs` component.
 *
 * Iterates `children` via `flattenChildren` to discover `<TabItem>` elements
 * and renders their labels as `<button>` elements in the tab nav bar.
 * The default panel is visible on first paint; `<TabsInit>` (the companion
 * script component) activates a stored tab after hydration.
 *
 * Place `<TabsInit>` once in the layout — NOT inside each `<Tabs>`.
 *
 * @example
 * ```tsx
 * <Tabs>
 *   <TabItem label="npm"><code>npm install …</code></TabItem>
 *   <TabItem label="pnpm" default><code>pnpm add …</code></TabItem>
 * </Tabs>
 * ```
 */
export function Tabs({ groupId, children }: TabsProps): JSX.Element {
  // Flatten children and locate TabItem descriptions so we can build nav buttons.
  //
  // Flatten arrays while preserving each child description for inspection.
  const childArray = flattenChildren(children);

  // Step 1 — keep only descriptions whose `type` is the TabItem function.
  const tabItemNodes = childArray.filter(
    (child): child is Description =>
      typeof child === "object" &&
      child !== null &&
      (child as Description).type === TabItem,
  );

  // Step 2 — cast props to the known shape so the JSX below is type-safe.
  const tabItems = tabItemNodes.map((n) => ({
    ...n,
    props: n.props as unknown as TabItemProps,
  }));

  // Wave 11: pre-resolve the default tab's `value` so the SSR HTML can
  // render the correct button as active and leave the matching panel
  // unhidden. Resolution mirrors the runtime fallback in
  // `tabs-init-script.ts`: the first TabItem with `default` wins; if no
  // child opts in, the first TabItem becomes the implicit default. This
  // keeps the no-JS path usable and avoids a hidden-everything flash
  // before the init script runs.
  const explicitDefault = tabItems.find((item) => item.props.default === true);
  const fallbackDefault = tabItems[0];
  const defaultItem = explicitDefault ?? fallbackDefault;
  const defaultValue = defaultItem
    ? defaultItem.props.value ?? defaultItem.props.label
    : undefined;

  // Re-walk children so each TabItem panel knows whether it is the
  // implicit default. Non-TabItem children (the test "renders non-
  // TabItem children in the content area" guards this) flow through
  // unchanged so mixed content keeps working.
  const renderedChildren = childArray.map((child) => {
    if (
      typeof child === "object" &&
      child !== null &&
      (child as Description).type === TabItem
    ) {
      const node = child as Description;
      const props = node.props as unknown as TabItemProps;
      const value = props.value ?? props.label;
      const isDefault = value === defaultValue;
      return h(node.type, { ...node.props, default: isDefault, key: node.key });
    }
    return child;
  });

  return (
    <div
      class="my-vsp-md"
      data-tabs
      data-group-id={groupId}
    >
      <div class="flex border-b border-muted" role="tablist" data-tabs-nav>
        {tabItems.map((item) => {
          const value = item.props.value ?? item.props.label;
          const isActive = value === defaultValue;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              class={isActive ? ACTIVE_BTN_CLASS : INACTIVE_BTN_CLASS}
              data-tab-btn={value}
              aria-selected={isActive ? "true" : "false"}
            >
              {item.props.label}
            </button>
          );
        })}
      </div>
      <div data-tabs-content>{renderedChildren}</div>
    </div>
  );
}
