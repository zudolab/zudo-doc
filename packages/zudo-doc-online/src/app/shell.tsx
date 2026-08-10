import type { ComponentChildren } from "preact";
import type { ProjectStore } from "../store/contract.js";
import type { ProjectEventsClient } from "../store/events.js";
import { ThemeToggle } from "../theme/theme-toggle.js";
import { useEditorEntryPageId } from "./editor-entry.js";
import type { KeyValueStorage } from "../features/editor/persistence.js";
import { formatRoute, type Route } from "./router.js";

const NAV_LINK_CLASSES =
  "text-small text-fg hover:text-accent hover:underline focus-visible:text-accent focus-visible:underline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 aria-[current=page]:text-accent";

// There is no page to open yet (or no project at all). A link that 404s would
// be worse than no link, so the item is rendered inert.
const NAV_ITEM_DISABLED_CLASSES = "text-small text-muted cursor-not-allowed";

export interface ShellProps {
  route: Route;
  /**
   * Where the Editor nav link's target page is read from (`editor-entry.ts`).
   * `null` — the default — means "no snapshot to consult", which is what a
   * spec or any mount without a live server gets.
   */
  store?: ProjectStore | null;
  /** Keeps that target current as the outline changes. */
  events?: ProjectEventsClient | null;
  /** Test seam, forwarded to `useEditorEntryPageId`. */
  storage?: KeyValueStorage | null;
  children?: ComponentChildren;
}

export function Shell({ route, store = null, events, storage, children }: ShellProps) {
  const editorPageId = useEditorEntryPageId(route, { store, events, storage });

  return (
    // `h-dvh`, not `min-h-dvh`: a MIN height is not a definite height, so
    // `main`'s `flex-1` share of it is not definite either, and the routed
    // surface's `h-full` (both the editor workspace and the outline page use
    // it) has no percentage base to resolve against — it silently collapses to
    // content height, leaving hundreds of pixels of dead space below the app.
    // Every link in this chain has to carry a real height for the last one to
    // work.
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <header className="flex items-center gap-hsp-lg border-b border-border px-hsp-xl py-vsp-xs">
        <a
          href={formatRoute({ name: "outline" })}
          className="text-title font-semibold hover:text-accent focus-visible:text-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
        >
          zudo-doc online
        </a>
        <span className="text-small text-muted">Aurora Docs</span>
        <nav className="flex gap-hsp-md" aria-label="Primary">
          <a
            href={formatRoute({ name: "outline" })}
            aria-current={route.name === "outline" ? "page" : undefined}
            className={NAV_LINK_CLASSES}
          >
            Outline
          </a>
          {editorPageId === null ? (
            <span aria-disabled="true" className={NAV_ITEM_DISABLED_CLASSES}>
              Editor
            </span>
          ) : (
            <a
              href={formatRoute({ name: "editor", pageId: editorPageId })}
              aria-current={route.name === "editor" ? "page" : undefined}
              className={NAV_LINK_CLASSES}
            >
              Editor
            </a>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-hsp-md">
          <ThemeToggle />
          <span
            aria-hidden="true"
            className="flex size-(--icon-lg) items-center justify-center rounded-full bg-accent-soft text-caption font-semibold text-accent"
          >
            TZ
          </span>
        </div>
      </header>
      {/*
        `flex-1` alone only GROWS this box — it establishes no height for a
        child to measure against. `min-h-0` lets it shrink below its content
        (without it a tall surface would push the column past the viewport
        instead of scrolling inside), and `flex flex-col` makes it a real
        height-establishing container so the routed surface's `h-full`
        resolves and its internal panes scroll independently.
      */}
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
