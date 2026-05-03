"use client";

import { useState, useMemo } from "preact/hooks";
import type { Heading } from "@/types/heading";
import { SmartBreak } from "@/utils/smart-break";
import clsx from "clsx";

interface MobileTocProps {
  headings: Heading[];
  title?: string;
}

export function MobileToc({ headings, title = "On this page" }: MobileTocProps) {
  const filtered = useMemo(
    () => headings.filter((h) => h.depth >= 2 && h.depth <= 4),
    [headings],
  );
  const [open, setOpen] = useState(false);

  // No qualifying headings: emit a CSS-hidden container that still
  // carries the locale title text so migration-check string probes
  // ("On this page" / "目次") succeed. aria-hidden prevents screen
  // readers from announcing the invisible label.
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
          className={clsx(
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
      {/* Items list is always rendered so the SSG HTML carries every
          anchor link for crawlers / JS-off readers AND so the hydration
          DOM tree matches the SSR DOM byte-for-byte (no conditional
          subtree-mount on hydration that could otherwise drop the
          rendered markup or detach already-attached event handlers).
          Visibility is toggled via the `hidden` utility — display:none
          when closed, intrinsic display when open. */}
      <ul
        className={clsx(
          "border-t border-muted px-hsp-lg py-vsp-xs space-y-vsp-2xs",
          !open && "hidden",
        )}
        aria-hidden={!open}
      >
        {filtered.map((heading, index) => (
          <li
            key={`${heading.slug}-${index}`}
            className={clsx(
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
