/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// doc-pager — factory for the shared prev/next pager <nav> (epic #2344, S7).
//
// The host's `pages/lib/_doc-pager.tsx` previously read the `t` function
// from `@/config/i18n` at module scope. This factory receives `t` as an
// injected dependency so the logic lives in the package while the host stub
// keeps the singleton imports.

import type { JSX } from "preact";
import { ChevronLeft, ChevronRight } from "../icons/index.js";
import type { ChromeContext } from "../factory-context/index.js";
import type { Settings } from "../settings.js";

// NavNode is a superset; we only need the fields the pager uses.
interface PagerNode {
  href?: string;
  label: string;
}

export interface DocPagerProps {
  /** Previous page node (null = no previous page → renders placeholder). */
  prev: PagerNode | null;
  /** Next page node (null = no next page → renders placeholder). */
  next: PagerNode | null;
  /** Active locale for translated "Previous" / "Next" labels. */
  locale: string;
}

/**
 * Create a `DocPager` component from the unified {@link ChromeContext}
 * (epic Collapse Wiring Shells #2420, FACTORIES #2424 — breaking signature).
 * Reads only the `t` translator off the context.
 */
export function createDocPager<S extends Settings = Settings>(
  ctx: ChromeContext<S>,
): (props: DocPagerProps) => JSX.Element {
  const t = ctx.t;

  /**
   * Prev/next pagination nav shared by all four doc-route page components.
   *
   * Renders a two-column grid: prev card on the left, next card on the right.
   * When a node is absent its slot is filled with an empty `<div>` to maintain
   * the two-column layout. Placement: immediately after MDX content, before
   * `DocHistoryArea` (Astro reference order — content → pager → utilities,
   * per #1535).
   */
  function DocPager({ prev, next, locale }: DocPagerProps): JSX.Element {
    return (
      <nav class="mt-vsp-2xl grid grid-cols-2 gap-hsp-xl">
        {prev ? (
          <a
            href={prev.href}
            class="group border border-muted rounded-lg p-hsp-lg hover:border-accent"
          >
            <div class="flex items-center gap-hsp-xs text-caption text-muted mb-vsp-2xs">
              <ChevronLeft className="h-[1.125rem] w-[1.125rem]" />
              <span class="no-underline">{t("nav.previous", locale)}</span>
            </div>
            <p class="text-small font-semibold underline group-hover:text-accent">
              {prev.label}
            </p>
          </a>
        ) : (
          <div />
        )}
        {next ? (
          <a
            href={next.href}
            class="group border border-muted rounded-lg p-hsp-lg hover:border-accent text-right"
          >
            <div class="flex items-center justify-end gap-hsp-xs text-caption text-muted mb-vsp-2xs">
              <span class="no-underline">{t("nav.next", locale)}</span>
              <ChevronRight className="h-[1.125rem] w-[1.125rem]" />
            </div>
            <p class="text-small font-semibold underline group-hover:text-accent">
              {next.label}
            </p>
          </a>
        ) : (
          <div />
        )}
      </nav>
    );
  }

  return DocPager;
}
