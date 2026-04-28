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

import { toChildArray } from "preact";
import type { ComponentChildren, JSX, VNode } from "preact";
import { TabItem } from "../tab-item/tab-item.js";
import type { TabItemProps } from "../tab-item/tab-item.js";

const BASE_BTN_CLASS =
  "px-hsp-lg py-vsp-xs text-small font-medium border-b-[5px] -mb-px transition-colors";
/** Initially every button is inactive; the TabsInit script activates the correct one. */
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

  return (
    <div
      class="tabs-container my-vsp-md"
      data-tabs
      data-group-id={groupId}
    >
      <div class="tabs-nav flex border-b border-muted" role="tablist">
        {tabItems.map((item) => (
          <button
            key={item.props.value ?? item.props.label}
            type="button"
            role="tab"
            class={INACTIVE_BTN_CLASS}
            data-tab-btn={item.props.value ?? item.props.label}
            aria-selected="false"
          >
            {item.props.label}
          </button>
        ))}
      </div>
      <div class="tabs-content">{children}</div>
    </div>
  );
}

export default Tabs;
