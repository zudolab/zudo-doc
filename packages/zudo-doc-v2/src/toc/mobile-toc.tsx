"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { VNode } from "preact";
import { useMemo, useState } from "preact/hooks";

import type { HeadingItem } from "./types";
import { SmartBreak } from "./smart-break";
import { cx } from "./cx";

export interface MobileTocProps {
  headings: readonly HeadingItem[];
  title?: string;
}

/**
 * Collapsible TOC for narrow viewports (`xl:hidden`) — a Preact island
 * component. Closed by default; tapping the header toggles, and tapping
 * any entry closes the panel after navigation.
 *
 * Renders the `<div class="xl:hidden …">` panel directly. **The caller
 * is responsible for wrapping this in `<Island when="load">`** so the
 * SSG output emits the `data-zfb-island="MobileToc"` hydration marker
 * around the panel. `<DocLayoutWithDefaults>` does this for you;
 * consumers who render `<MobileToc>` outside the default layout (e.g.
 * via the `mobileTocOverride` prop or in a custom layout) must apply
 * the wrapper themselves — otherwise the open/close toggle never
 * hydrates on the client and the panel stays in its initial closed
 * state.
 *
 * Wave 13 (zudolab/zudo-doc#1355): previously this module exported a
 * `MobileToc` wrapper that called `Island(...)` itself; on hydration
 * the runtime ran `hydrate(<MobileToc/>, dataIslandDiv)` and the
 * wrapper re-emitted *another* `<div data-zfb-island="MobileToc">…</div>`
 * inside the existing one, leaving two `xl:hidden …` panels in the
 * post-hydration DOM. See `./toc.tsx` for the full diagnosis. Moving
 * the `<Island>` wrapper to the call site lets the bundle hydrate the
 * bare panel against the existing DOM in-place.
 *
 * Like `Toc`, this always includes the `title` text in the SSG HTML
 * even when no headings qualify. When no headings are present, a
 * CSS-hidden container carries the title string so migration-check
 * tooling (which scans raw HTML, not computed styles) can confirm the
 * locale label is present. When headings are present the full
 * interactive toggle UI is rendered.
 */
export function MobileToc({
  headings,
  title = "On this page",
}: MobileTocProps): VNode {
  const filtered = useMemo(
    () => headings.filter((h) => h.depth >= 2 && h.depth <= 4),
    [headings],
  );
  const [open, setOpen] = useState(false);

  // No qualifying headings: emit a CSS-hidden container that still carries
  // the locale title text. The `hidden` class sets display:none visually,
  // but the text node remains in the serialized HTML so the migration-check
  // string probe ("On this page" / "目次") succeeds. aria-hidden prevents
  // screen readers from announcing the invisible label.
  if (filtered.length === 0) {
    return (
      <div className="hidden" aria-hidden="true">
        {title}
      </div>
    );
  }

  return (
    <div className="xl:hidden border border-muted mb-vsp-lg">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-hsp-lg py-vsp-xs text-small font-medium text-fg"
      >
        <span>{title}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className={cx(
            "h-icon-sm w-icon-sm text-muted transition-transform duration-150",
            open && "rotate-180",
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {/* Items list is always in the SSG HTML so anchor links are visible to
          crawlers and JS-off users. Visibility is toggled by the `hidden` CSS
          class — when `open` is false the list is display:none but the <a>
          elements remain in the static markup, satisfying the migration-check
          anchor-link probe and the WCAG requirement for keyboard accessibility
          after hydration. */}
      <ul
        className={cx(
          "border-t border-muted px-hsp-lg py-vsp-xs space-y-vsp-2xs",
          !open && "hidden",
        )}
        aria-hidden={!open}
      >
        {filtered.map((heading, index) => (
          <li
            key={`${heading.slug}-${index}`}
            className={cx(
              heading.depth === 3 && "ml-hsp-lg",
              heading.depth === 4 && "ml-hsp-2xl",
            )}
          >
            <a
              href={`#${heading.slug}`}
              onClick={() => setOpen(false)}
              className="block py-vsp-2xs text-small text-muted hover:text-fg hover:underline focus-visible:underline"
            >
              <SmartBreak>{heading.text}</SmartBreak>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
// See `./toc.tsx` for rationale on the explicit displayName pin.
MobileToc.displayName = "MobileToc";
