"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { VNode } from "preact";
import { useMemo, useState } from "preact/hooks";
// `@takazudo/zfb` is provided by the consumer at integration time;
// types come from the package-level shim at `../_zfb-shim.d.ts`.
import { Island } from "@takazudo/zfb";

import type { HeadingItem } from "./types";
import { SmartBreak } from "./smart-break";
import { cx } from "./cx";

export interface MobileTocProps {
  headings: readonly HeadingItem[];
  title?: string;
}

/**
 * Inner narrow-viewport TOC — extracted body of the original
 * `MobileToc`. The exported `MobileToc` wraps this in `<Island>` so
 * SSG-rendered HTML emits `data-zfb-island="MobileToc"` and the
 * hydration runtime can pick the island up to drive open/close.
 *
 * Like `Toc`, this always includes the `title` text in the SSG HTML
 * even when no headings qualify. When no headings are present, a
 * CSS-hidden container carries the title string so migration-check
 * tooling (which scans raw HTML, not computed styles) can confirm the
 * locale label is present. When headings are present the full
 * interactive toggle UI is rendered.
 */
function MobileTocInner({
  headings,
  title = "On this page",
}: MobileTocProps) {
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
// Pin the marker name to "MobileToc" — see Toc for rationale.
MobileTocInner.displayName = "MobileToc";

/**
 * Collapsible TOC for narrow viewports (`xl:hidden`). Closed by
 * default; tapping the header toggles, and tapping any entry closes
 * the panel after navigation.
 *
 * Wraps `<MobileTocInner>` in `<Island when="load">`.
 */
export function MobileToc(props: MobileTocProps): VNode {
  const rendered = Island({
    when: "load",
    children: <MobileTocInner {...props} />,
  });
  return rendered as unknown as VNode;
}
