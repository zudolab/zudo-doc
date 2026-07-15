/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// CodeGroup — adapter for zfb's `:::code-group` directive (codeTabs Option A).
// Moved from the showcase's `src/components/content/code-group.tsx` into the
// shared package as part of the package-first migration (epic #2321, S4 #2327).
//
// zfb emits:
//   <CodeGroup tabs={["label1", "label2", ...]}>
//     <pre data-lang="ts">{RAW code text}</pre>
//     <pre data-lang="js">{RAW code text}</pre>
//   </CodeGroup>
//
// The existing <Tabs>/<TabItem> UI uses a children-based API, so this
// component zips the `tabs` label array with the `<pre data-lang>` children
// by index, wrapping each in a <TabItem> with the matching label.
//
// Code inside each <pre> is raw text (the class-mode highlighting pipeline
// does not run inside code-group fences). We render
// the <pre> inside a <TabItem> with explicit styling via Tailwind tokens
// so it looks like a code block visually.
//
// TabsInit (the companion init script) is expected to be present in the
// consumer's layout — we do not duplicate it here.

import type { ComponentChildren } from "preact";
import { Tabs } from "../code-syntax/index.js";
import { TabItem } from "../tab-item/index.js";

type Props = {
  tabs?: string[];
  children?: ComponentChildren;
  [key: string]: unknown;
};

function toArray(children: ComponentChildren): ComponentChildren[] {
  if (!children) return [];
  if (Array.isArray(children)) return children;
  return [children];
}

export function CodeGroup({ tabs = [], children, name }: Props) {
  const childArray = toArray(children);

  // Zip tabs labels with pre children by index. Extra children beyond the
  // tabs array (shouldn't happen in normal zfb output) are ignored.
  const items = tabs.map((label, i) => {
    const child = childArray[i];
    return { label, child };
  });

  if (items.length === 0) {
    // Degenerate: no tabs — render children as-is.
    return <>{children}</>;
  }

  // zfb forwards `:::code-group{name="x"}` as the `name` prop; Tabs persists
  // the active tab per group via `groupId`.
  const groupId = typeof name === "string" ? name : undefined;

  return (
    <Tabs groupId={groupId}>
      {items.map(({ label, child }, i) => (
        // value is suffixed with the index so two fences sharing a label
        // (e.g. both titled "ts") get distinct stable tab identities; the
        // label stays the visible text.
        <TabItem
          key={`${label}-${i}`}
          label={label}
          value={`${label}-${i}`}
          default={i === 0 ? true : undefined}
        >
          {/* Raw-code <pre> from zfb: apply code-block visual treatment via tokens */}
          <div class="code-group-panel">{child}</div>
        </TabItem>
      ))}
    </Tabs>
  );
}
