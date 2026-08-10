/**
 * The workspace rail, in its two persisted states.
 *
 * Expanded (240px) is a1's page-tree panel; collapsed (48px) is a3's icon
 * rail, whose pages button opens the same tree as a flyout. The two-state
 * design — rather than a draggable width — is the user feedback recorded in
 * `_temp-resource/3327-zudo-doc-online/REFERENCE.md`, and `rail-state.ts`
 * explains why a discrete mode is what gets persisted.
 *
 * The toggle affordance sits on the rail's own trailing edge in both states
 * (a header chevron when expanded, a footer chevron when collapsed) and its
 * `aria-label` always names the state it will produce, matching the
 * `ThemeToggle` contract this app already established.
 */

import { useRef } from "preact/hooks";
import { formatRoute } from "../../app/router";
import { PagesFlyout } from "./flyout";
import { ChevronLeftIcon, ChevronRightIcon, OutlineIcon, PagesIcon } from "./icons";
import { PageTree } from "./page-tree";
import type { EditorTreeCategory } from "./page-index";
import type { RailMode } from "./rail-state";

const RAIL_BUTTON_CLASSES =
  "grid size-(--zdo-rail-btn) flex-none place-items-center rounded-md text-muted hover:bg-(--zdo-wash-hover) hover:text-fg-mild focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const ICON_BUTTON_CLASSES =
  "grid size-(--icon-lg) flex-none place-items-center rounded-sm text-muted hover:bg-(--zdo-wash-hover) hover:text-fg-mild focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

export interface EditorRailProps {
  mode: RailMode;
  onToggleMode: () => void;
  /** The active project's slug — threaded into the Outline link (#3347). */
  projectSlug: string;
  projectTitle: string;
  tree: readonly EditorTreeCategory[];
  pageCount: number;
  activePageId: string | null;
  dirtyPageIds: ReadonlySet<string>;
  onOpenPage: (pageId: string) => void;
  flyoutOpen: boolean;
  onFlyoutOpenChange: (open: boolean) => void;
}

export function EditorRail(props: EditorRailProps) {
  return props.mode === "expanded" ? <ExpandedRail {...props} /> : <CollapsedRail {...props} />;
}

function ExpandedRail({
  onToggleMode,
  projectSlug,
  projectTitle,
  tree,
  pageCount,
  activePageId,
  dirtyPageIds,
  onOpenPage,
}: EditorRailProps) {
  return (
    <nav
      aria-label="Pages"
      className="flex min-h-[0px] w-(--zdo-rail-expanded) flex-none flex-col border-r border-border bg-surface"
    >
      <div className="flex flex-none items-center gap-hsp-sm border-b border-border px-hsp-md py-vsp-xs">
        <span className="truncate text-small font-semibold">{projectTitle}</span>
        <span className="flex-none text-caption text-muted">{pageCount} pages</span>
        <button
          type="button"
          onClick={onToggleMode}
          aria-label="Collapse the page rail"
          title="Collapse the page rail"
          className={`ml-auto ${ICON_BUTTON_CLASSES}`}
        >
          <ChevronLeftIcon />
        </button>
      </div>

      <PageTree
        tree={tree}
        activePageId={activePageId}
        dirtyPageIds={dirtyPageIds}
        onOpenPage={onOpenPage}
        label="Project pages"
      />

      <div className="flex flex-none items-center gap-hsp-xs border-t border-border px-hsp-md py-vsp-xs text-caption text-muted">
        <span className="size-(--zdo-dot) rounded-full bg-warning" aria-hidden="true" />
        <span>draft</span>
        <a
          href={formatRoute({ name: "outline", projectSlug })}
          className="ml-auto hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
        >
          Outline editor
        </a>
      </div>
    </nav>
  );
}

function CollapsedRail({
  onToggleMode,
  projectSlug,
  tree,
  pageCount,
  activePageId,
  dirtyPageIds,
  onOpenPage,
  flyoutOpen,
  onFlyoutOpenChange,
}: EditorRailProps) {
  const pagesButtonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <nav
      aria-label="Workspace panels"
      className="relative flex min-h-[0px] w-(--zdo-rail-collapsed) flex-none flex-col items-center gap-hsp-2xs border-r border-border bg-surface py-vsp-xs"
    >
      <button
        ref={pagesButtonRef}
        type="button"
        aria-label="Pages"
        title="Pages"
        aria-haspopup="dialog"
        aria-expanded={flyoutOpen}
        onClick={() => onFlyoutOpenChange(!flyoutOpen)}
        onMouseEnter={() => onFlyoutOpenChange(true)}
        className={`relative ${RAIL_BUTTON_CLASSES} ${
          flyoutOpen ? "bg-(--zdo-wash-active) text-accent" : ""
        }`}
      >
        {flyoutOpen ? (
          <span
            aria-hidden="true"
            className="absolute left-[0px] top-vsp-2xs bottom-vsp-2xs w-(--zdo-rail-marker) rounded-full bg-accent"
          />
        ) : null}
        <PagesIcon size="--icon-md" />
      </button>

      <a
        href={formatRoute({ name: "outline", projectSlug })}
        aria-label="Outline editor"
        title="Outline editor"
        className={RAIL_BUTTON_CLASSES}
      >
        <OutlineIcon size="--icon-md" />
      </a>

      <span className="flex-1" />

      <button
        type="button"
        onClick={onToggleMode}
        aria-label="Expand the page rail"
        title="Expand the page rail"
        className={RAIL_BUTTON_CLASSES}
      >
        <ChevronRightIcon />
      </button>

      <PagesFlyout
        open={flyoutOpen}
        tree={tree}
        pageCount={pageCount}
        activePageId={activePageId}
        dirtyPageIds={dirtyPageIds}
        onOpenPage={onOpenPage}
        onClose={() => onFlyoutOpenChange(false)}
        triggerRef={pagesButtonRef}
      />
    </nav>
  );
}
