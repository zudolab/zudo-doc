"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { VNode } from "preact";
import { useMemo } from "preact/hooks";

import { useActiveHeading } from "./use-active-heading.js";
import type { HeadingItem } from "./types.js";
import { SmartBreak } from "./smart-break.js";
import { cx } from "./cx.js";

export interface TocProps {
  headings: readonly HeadingItem[];
  /**
   * Section label used by MobileToc. The desktop Toc no longer renders
   * a visible heading (issue #1655 / T1) but the prop is kept so callers
   * can share a single title value for both desktop and mobile surfaces.
   * Defaults to "On this page" (English).
   */
  title?: string;
}

/**
 * Desktop right-rail Table of Contents — a Preact island component.
 *
 * Renders the `<nav aria-label="Table of contents">` directly. **The
 * caller is responsible for wrapping this in `<Island when="load">`**
 * so the SSG output emits the `data-zfb-island="Toc"` hydration marker
 * around the nav. `<DocLayoutWithDefaults>` does this for you; consumers
 * who render `<Toc>` outside the default layout (e.g. via the
 * `tocOverride` prop or in a custom layout) must apply the wrapper
 * themselves — otherwise the active-section scroll-spy never hydrates
 * on the client and the nav stays static.
 *
 * Wave 13 ("smoke-toc duplicate-nav regression", zudolab/zudo-doc#1355):
 * before this refactor, this module exported a `Toc` wrapper that itself
 * called `Island(...)` internally and an inner `TocInner` component that
 * carried `displayName = "Toc"`. The zfb island scanner picked the
 * exported `Toc` (the wrapper) as the hydration target, so on the
 * client `mountIslands` ran `hydrate(<Toc/>, dataIslandDiv)` where the
 * vnode itself rendered to *another* `<div data-zfb-island="Toc">…<nav>…</nav></div>`
 * — Preact appended the new wrapper-div as a child of the existing
 * data-zfb-island element instead of in-place hydrating the inner nav,
 * leaving two `<nav aria-label="Table of contents">` elements in the
 * post-hydration DOM. The host's Wave 12 prop-serialisation pin
 * (`data-props`) made hydration succeed where it previously crashed
 * silently on the missing `headings` prop, which is why the duplicate
 * only became visible in CI smoke runs after Wave 12. Moving the
 * `<Island>` wrapper to the call site lets the bundle hydrate the bare
 * `<nav>` against the existing DOM in-place, eliminating the duplicate.
 *
 * Renders only depth 2–4 headings (h2/h3/h4), matching zudo-doc's
 * historical behavior — the page title (h1) is rendered separately by
 * the layout and h5+ are deemed too granular for the TOC.
 *
 * The `title` prop is kept on the signature (MobileToc and callers still
 * use it) but the desktop Toc no longer renders a visible heading — the
 * `<nav aria-label="Table of contents">` landmark provides the section
 * semantics for screen readers. Issue #1655 / T1.
 */
export function Toc({ headings, title = "On this page" }: TocProps): VNode {
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
      {filtered.length > 0 && (
        <ul className="border-l border-muted pl-hsp-lg overflow-y-auto">
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
// Pin the marker name to "Toc" explicitly so the SSR pass `<Island>` wrapper
// resolves a stable component identity even after esbuild minification has
// renamed the function. captureComponentName reads displayName first, then
// falls back to function.name; setting both means the SSR marker stays
// "Toc" no matter which path the runtime takes.
Toc.displayName = "Toc";
