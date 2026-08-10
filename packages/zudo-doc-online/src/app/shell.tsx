import type { ComponentChildren } from "preact";
import type { ProjectStore } from "../store/contract.js";
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
  /** Test seam, forwarded to `useEditorEntryPageId`. */
  storage?: KeyValueStorage | null;
  children?: ComponentChildren;
}

export function Shell({ route, store = null, storage, children }: ShellProps) {
  const editorPageId = useEditorEntryPageId(route, { store, storage });

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
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
      <main className="flex-1">{children}</main>
    </div>
  );
}
