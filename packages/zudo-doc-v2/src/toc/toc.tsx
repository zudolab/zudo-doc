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
}

/**
 * Inner desktop right-rail Table of Contents — the renamed body of the
 * original `Toc` component. The exported `Toc` wraps this in `<Island>`
 * so SSG output emits `data-zfb-island="Toc"` for the hydration
 * runtime to find.
 *
 * Renders only depth 2–4 headings (h2/h3/h4), matching zudo-doc's
 * historical behavior — the page title (h1) is rendered separately by
 * the layout and h5+ are deemed too granular for the TOC. Components
 * with no in-range headings render an empty hidden nav so layout
 * reservations stay stable across pages.
 */
function TocInner({ headings }: TocProps) {
  const filtered = useMemo(
    () => headings.filter((h) => h.depth >= 2 && h.depth <= 4),
    [headings],
  );
  const { activeId, activate } = useActiveHeading(filtered);

  if (filtered.length === 0) return <nav className="hidden" />;

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
