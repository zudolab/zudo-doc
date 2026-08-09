/**
 * The open-pages tab strip (a3's `.tabrow`).
 *
 * Each tab carries two independent signals that are easy to conflate: the
 * **draft badge** is the page's own frontmatter flag (a published-state fact,
 * true even for a page nobody has open), while the **dirty dot** is this
 * session's unsaved work, read from that tab's save machine. A page can be
 * either, both, or neither.
 *
 * Markup shape is dictated by the close button: a `<button>` cannot nest
 * inside another `<button>`, so each tab is a `role="presentation"` wrapper
 * carrying the visual chrome around two sibling buttons — the `role="tab"`
 * label and the close control. That is the standard workaround for a closable
 * tab, and it keeps the tablist's ownership of its tabs intact.
 *
 * Arrow keys move AND activate (automatic activation), which is the correct
 * ARIA pattern when selecting a tab has no cost — here it only swaps which
 * already-loaded session is on screen.
 */

import { useEffect, useRef } from "preact/hooks";
import { CloseIcon } from "./icons";
import { neighbourTab } from "./tabs-state";

export interface EditorTabDescriptor {
  pageId: string;
  title: string;
  draft: boolean;
  dirty: boolean;
}

export interface TabStripProps {
  tabs: readonly EditorTabDescriptor[];
  activePageId: string | null;
  onActivate: (pageId: string) => void;
  onClose: (pageId: string) => void;
}

export function TabStrip({ tabs, activePageId, onActivate, onClose }: TabStripProps) {
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (activePageId === null) return;
    // jsdom has no scrollIntoView; the optional call keeps specs honest
    // rather than forcing a stub into every one of them.
    tabRefs.current.get(activePageId)?.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
    });
  }, [activePageId]);

  function moveFocus(direction: "previous" | "next") {
    const target = neighbourTab(
      { openIds: tabs.map((tab) => tab.pageId), activeId: activePageId },
      direction,
    );
    if (target === null) return;
    onActivate(target);
    tabRefs.current.get(target)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Open pages"
      className="flex flex-none items-end gap-hsp-2xs overflow-x-auto border-b border-border bg-surface px-hsp-sm pt-vsp-xs"
    >
      {tabs.map((tab) => {
        const active = tab.pageId === activePageId;
        return (
          <span
            key={tab.pageId}
            role="presentation"
            className={[
              "-mb-px flex flex-none items-center gap-hsp-xs rounded-t-md border border-b-0 pr-hsp-xs",
              active
                ? "border-border border-t-2 border-t-accent bg-bg text-fg"
                : "border-transparent text-muted hover:bg-(--zdo-wash-hover-soft) hover:text-fg-mild",
            ].join(" ")}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              ref={(element) => {
                if (element) tabRefs.current.set(tab.pageId, element);
                else tabRefs.current.delete(tab.pageId);
              }}
              onClick={() => onActivate(tab.pageId)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  moveFocus("next");
                } else if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  moveFocus("previous");
                }
              }}
              className={`flex items-center gap-hsp-sm whitespace-nowrap py-vsp-xs pl-hsp-md text-small focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${
                active ? "font-medium" : ""
              }`}
            >
              {tab.dirty ? (
                <span
                  className="size-(--zdo-dot) flex-none rounded-full bg-accent"
                  role="img"
                  aria-label="Unsaved edits"
                />
              ) : null}
              <span>{tab.title}</span>
              {tab.draft ? (
                <span className="rounded-full bg-(--zdo-wash-warning) px-hsp-xs text-caption font-semibold text-warning">
                  draft
                </span>
              ) : null}
            </button>

            <button
              type="button"
              aria-label={`Close ${tab.title}`}
              title={`Close ${tab.title}`}
              onClick={() => onClose(tab.pageId)}
              className="grid size-(--icon-md) flex-none place-items-center rounded-sm text-muted hover:bg-(--zdo-wash-hover) hover:text-fg-mild focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
            >
              <CloseIcon />
            </button>
          </span>
        );
      })}
    </div>
  );
}
