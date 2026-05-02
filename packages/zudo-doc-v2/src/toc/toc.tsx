"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { VNode } from "preact";
import { useMemo } from "preact/hooks";
// `@takazudo/zfb` is provided by the consumer at integration time;
// types come from the package-level shim at `../_zfb-shim.d.ts`.
import { Island } from "@takazudo/zfb";

import { useActiveHeading } from "./use-active-heading";
import type { HeadingItem } from "./types";
import { SmartBreak } from "./smart-break";
import { cx } from "./cx";

export interface TocProps {
  headings: readonly HeadingItem[];
  /**
   * Section label rendered as a static h2 above the outline list.
   * Defaults to "On this page" (English). Pass the i18n-resolved
   * equivalent (e.g. "目次" for Japanese) from the caller so SSG HTML
   * always contains the correct locale string — required for
   * migration-check parity on non-EN routes.
   */
  title?: string;
}

/**
 * Inner desktop right-rail Table of Contents — the renamed body of the
 * original `Toc` component. The exported `Toc` wraps this in `<Island>`
 * so SSG output emits `data-zfb-island="Toc"` for the hydration
 * runtime to find.
 *
 * Renders only depth 2–4 headings (h2/h3/h4), matching zudo-doc's
 * historical behavior — the page title (h1) is rendered separately by
 * the layout and h5+ are deemed too granular for the TOC.
 *
 * The section `title` h2 is always rendered even when there are no
 * qualifying headings — this preserves the "On this page" / locale
 * string in the SSG HTML for migration-check parity. When headings are
 * absent the `<ul>` is omitted so no empty list appears to users.
 */
function TocInner({ headings, title = "On this page" }: TocProps) {
  const filtered = useMemo(
    () => headings.filter((h) => h.depth >= 2 && h.depth <= 4),
    [headings],
  );
  const { activeId, activate } = useActiveHeading(filtered);

  return (
    <nav
      aria-label="Table of contents"
      className={cx(
        "hidden xl:flex flex-col",
        "w-[280px] shrink-0",
        "sticky top-[3.5rem] self-start z-10",
        "pt-vsp-xl lg:pt-vsp-2xl",
        "h-[calc(100vh-3.5rem)]",
      )}
    >
      <h2 className="mb-vsp-xs pl-hsp-lg text-small font-medium text-fg">
        {title}
      </h2>
      {filtered.length > 0 && (
        <ul className="border-l border-muted pl-hsp-lg overflow-y-auto flex-1 min-h-0">
          {filtered.map((heading, index) => {
            const isActive = heading.slug === activeId;
            return (
              <li
                key={`${heading.slug}-${index}`}
                className={cx(
                  heading.depth === 3 && "ml-hsp-lg",
                  heading.depth === 4 && "ml-hsp-2xl",
                )}
              >
                <a
                  href={`#${heading.slug}`}
                  onClick={() => activate(heading.slug)}
                  aria-current={isActive ? "true" : undefined}
                  className={cx(
                    "block py-vsp-2xs text-small leading-snug transition-colors",
                    isActive
                      ? "bg-fg text-bg font-medium"
                      : "text-muted hover:underline focus:underline",
                  )}
                >
                  <SmartBreak>{heading.text}</SmartBreak>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
// Pin the marker name to "Toc" so the hydration manifest can resolve
// the island regardless of how the bundler renames inner helpers.
TocInner.displayName = "Toc";

/**
 * Desktop right-rail Table of Contents. Sticky island that lights up
 * the heading nearest the top of the viewport via `useActiveHeading`.
 *
 * Wraps `<TocInner>` in `<Island when="load">` so the SSG renderer
 * emits `<div data-zfb-island="Toc" data-when="load">…</div>` and the
 * client-side hydration runtime can pick the island up.
 */
export function Toc(props: TocProps): VNode {
  const rendered = Island({
    when: "load",
    children: <TocInner {...props} />,
  });
  return rendered as unknown as VNode;
}
