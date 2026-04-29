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
 * Like `Toc`, this only renders depth 2–4 headings and returns a
 * hidden placeholder when nothing qualifies — keeps the surrounding
 * markup shape predictable across pages.
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

  if (filtered.length === 0) return <div className="hidden" />;

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
      {open && (
        <ul className="border-t border-muted px-hsp-lg py-vsp-xs space-y-vsp-2xs">
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
      )}
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
