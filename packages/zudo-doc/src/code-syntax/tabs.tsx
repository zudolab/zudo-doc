/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// JSX port of src/components/tabs.astro.
//
// The original .astro component rendered:
//   1. A container `<div data-tabs data-group-id={groupId}>`.
//   2. An empty `<div class="tabs-nav">` — the tab buttons were created
//      imperatively by the companion `tabs-init.astro` script at runtime.
//   3. A `<div class="tabs-content"><slot/></div>` holding the `<TabItem>`
//      panels.
//
// This JSX port takes a different (more SSR-friendly) approach:
//   - It uses Preact's `toChildArray` to discover `<TabItem>` children
//     server-side and renders the nav buttons statically in the HTML.
//   - The companion `<TabsInit>` component (see tabs-init.tsx) still needs
//     to be included in the layout; its script activates the correct tab
//     and wires click handlers — but it no longer has to create buttons.
//
// Children that are NOT `<TabItem>` elements are rendered into the content
// area unchanged, so mixed content (e.g. a heading above a tab set) works.

import { cloneElement, toChildArray } from "preact";
import type { ComponentChildren, JSX, VNode } from "preact";
import { TabItem } from "../tab-item/tab-item.js";
import type { TabItemProps } from "../tab-item/tab-item.js";

const BASE_BTN_CLASS =
  "px-hsp-lg py-vsp-xs text-small font-medium border-b-[5px] -mb-px transition-colors";
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
  children?: ComponentChildren;
}

/**
 * Server-rendered tab container — JSX port of `src/components/tabs.astro`.
 *
 * Iterates `children` via `toChildArray` to discover `<TabItem>` elements
 * and renders their labels as `<button>` elements in the tab nav bar.
 * All panels remain `hidden` on first paint; `<TabsInit>` (the companion
 * script component) activates the default/stored tab after hydration.
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
  // Flatten children and locate TabItem VNodes so we can build nav buttons.
  //
  // TypeScript note: `toChildArray` returns `(string | number | VNode<{}>)[]`.
  // We cannot use a type predicate of the form `child is VNode<TabItemProps>`
  // because TypeScript treats VNode generics invariantly — `VNode<TabItemProps>`
  // is not assignable to `VNode<{}>`. The two-step approach below narrows to
  // the opaque `VNode` type first, then casts the props to `TabItemProps`.
  const childArray = toChildArray(children);

  // Step 1 — keep only VNodes whose `type` is the TabItem function.
  const tabItemNodes = childArray.filter(
    (child): child is VNode =>
      typeof child === "object" &&
      child !== null &&
      (child as VNode).type === TabItem,
  );

  // Step 2 — cast props to the known shape so the JSX below is type-safe.
  const tabItems = tabItemNodes.map((n) => ({
    ...n,
    props: n.props as TabItemProps,
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
      (child as VNode).type === TabItem
    ) {
      const node = child as VNode;
      const props = node.props as TabItemProps;
      const value = props.value ?? props.label;
      const isDefault = value === defaultValue;
      return cloneElement(node, { default: isDefault });
    }
    return child;
  });

  return (
    <div
      class="tabs-container my-vsp-md"
      data-tabs
      data-group-id={groupId}
    >
      <div class="tabs-nav flex border-b border-muted" role="tablist">
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
      <div class="tabs-content">{renderedChildren}</div>
    </div>
  );
}

export default Tabs;
