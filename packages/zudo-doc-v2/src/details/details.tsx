/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { ComponentChildren, VNode } from "preact";

export interface DetailsProps {
  /**
   * Summary / toggle label shown in the `<summary>` element.
   * Defaults to `"Details"` — the same fallback used by the legacy
   * `src/components/details.astro`.
   */
  title?: string;
  /** Slot content rendered inside the collapsed body. */
  children?: ComponentChildren;
}

/**
 * Collapsible `<details>` / `<summary>` block — JSX port of
 * `src/components/details.astro`.
 *
 * Keeps layout and token classes identical to the original template.
 * The legacy component used Astro's `<slot />`; v2 accepts standard
 * Preact `children`.
 */
export function Details({ title = "Details", children }: DetailsProps): VNode {
  return (
    <details class="my-vsp-md border border-muted rounded-lg overflow-hidden">
      <summary class="cursor-pointer px-hsp-lg py-vsp-sm bg-surface font-medium text-fg select-none hover:text-accent">
        {title}
      </summary>
      <div class="px-hsp-lg py-vsp-sm zd-content">{children}</div>
    </details>
  );
}
