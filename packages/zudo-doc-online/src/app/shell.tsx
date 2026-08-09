import type { ComponentChildren } from "preact";
import { ThemeToggle } from "../theme/theme-toggle.js";
import { formatRoute, type Route } from "./router.js";

// The outline is the site-structure surface, so it doesn't need a pageId.
// The editor nav link needs SOME pageId to point at — later sub-issues
// (#3332's store, #3334's editor chrome) replace this with the
// last-opened / first page. Until then this mirrors the sample page from
// the accepted design references (DESIGN-SPEC.md's Surface A sample).
const SAMPLE_PAGE_ID = "getting-started/installation";

const NAV_LINK_CLASSES =
  "text-small text-fg hover:text-accent hover:underline focus-visible:text-accent focus-visible:underline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 aria-[current=page]:text-accent";

export interface ShellProps {
  route: Route;
  children?: ComponentChildren;
}

export function Shell({ route, children }: ShellProps) {
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
          <a
            href={formatRoute({ name: "editor", pageId: SAMPLE_PAGE_ID })}
            aria-current={route.name === "editor" ? "page" : undefined}
            className={NAV_LINK_CLASSES}
          >
            Editor
          </a>
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
