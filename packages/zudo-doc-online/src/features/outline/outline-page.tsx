/**
 * The outline surface: the B-v1 split of an indented structure tree against a
 * live preview of the site that structure produces, plus the Outline/Board
 * view switch.
 *
 * This component owns the three things neither pane should: the store wiring
 * (through `useOutlineSurface`), the shared selection, and every banner. Rows
 * report intent; the surface decides what that means for the project.
 *
 * Selection doubles as preview scope — picking a category scopes the sidebar
 * mock to it, and the derived top-page row scopes back out to the whole site.
 * It is also handed to the board view unchanged, so switching views keeps the
 * user where they were.
 *
 * GOTCHA for anything styled in this feature: `min-w-0` / `min-h-0` compile to
 * NOTHING here. Every numeric spacing utility derives from Tailwind's bare
 * `--spacing` multiplier, and this app's "approach B" import (preflight +
 * utilities, never the default theme — see the design-system skill) never
 * defines it, so those classes silently generate no rule. That matters
 * because both are load-bearing: without them a flex child refuses to shrink
 * below its content, which breaks every `truncate` and stops the two panes
 * from scrolling independently. `min-w-[0px]` / `min-h-[0px]` carry their own
 * unit and do not touch `--spacing`, which is why they are written that way
 * throughout.
 */

import { Suspense } from "preact/compat";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { OutlineCommand } from "../../core/outline/index.js";
import type { ProjectStore } from "../../store/contract.js";
import type { ProjectEventsClient } from "../../store/events.js";
import type { RevisionCoordinator } from "../../store/revision-coordinator.js";
import {
  addCategoryCommand,
  addPageCommand,
  moveCategoryCommand,
  movePageCommand,
  movePageToCategoryCommand,
  removeCategoryCommand,
  removePageCommand,
  renameCategoryCommand,
  setPageSlugCommand,
  type MoveDirection,
} from "./outline-actions.js";
import {
  buildOutlineTree,
  listMoveTargets,
  type OutlineTreeModel,
} from "./outline-model.js";
import { SitemapPreview } from "./sitemap-preview.js";
import { TreeView } from "./tree-view.js";
import {
  useOutlineSurface,
  type OutlineSaveState,
} from "./use-outline-surface.js";
import type { OutlineSelection, OutlineViewComponent } from "./view-props.js";
import {
  readOutlineView,
  writeOutlineView,
  type OutlineViewMode,
  type ViewPreferenceStorage,
} from "./view-preference.js";
import { ViewSwitch } from "./view-switch.js";

export interface OutlinePageProps {
  /** The coordinated store — every mutation is serialized through it. */
  store: ProjectStore;
  coordinator: RevisionCoordinator;
  /** Omit for no live change stream (tests, offline). */
  events?: ProjectEventsClient | null;
  /**
   * The board view (#3337). Absent until that sub-issue lands, in which case
   * Board mode mounts a labeled placeholder.
   */
  boardView?: OutlineViewComponent | undefined;
  /** Injectable so a test does not depend on real `localStorage`. */
  viewStorage?: ViewPreferenceStorage | undefined;
  basePath?: string;
}

const PANE_PADDING = "px-hsp-2xl py-vsp-lg";

export function OutlinePage({
  store,
  coordinator,
  events = null,
  boardView,
  viewStorage,
  basePath,
}: OutlinePageProps) {
  const surface = useOutlineSurface({ store, coordinator, events });
  const [view, setView] = useState<OutlineViewMode>(() =>
    readOutlineView(viewStorage),
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const autoSelectedRef = useRef(false);

  const { snapshot, dispatch, renamePage, beginEditing } = surface;

  const model = useMemo<OutlineTreeModel | null>(
    () =>
      snapshot === null
        ? null
        : buildOutlineTree(snapshot, basePath === undefined ? {} : { basePath }),
    [snapshot, basePath],
  );

  // Selection repair, in one place: it covers the category the user just
  // deleted, the one an agent deleted from another client, and the initial
  // "nothing selected yet" state — all of which arrive as a new model.
  useEffect(() => {
    if (model === null) return;
    const first = model.categories[0];
    if (
      selectedCategoryId !== null &&
      !model.categories.some((category) => category.id === selectedCategoryId)
    ) {
      setSelectedCategoryId(first?.id ?? null);
    } else if (selectedCategoryId === null && !autoSelectedRef.current) {
      autoSelectedRef.current = true;
      if (first !== undefined) setSelectedCategoryId(first.id);
    }
    if (focusedId !== null && !nodeExists(model, focusedId)) {
      setFocusedId(null);
    }
  }, [model, selectedCategoryId, focusedId]);

  const changeView = useCallback(
    (next: OutlineViewMode) => {
      setView(next);
      writeOutlineView(next, viewStorage);
    },
    [viewStorage],
  );

  const send = useCallback(
    (command: OutlineCommand | null) => {
      if (command === null) return;
      void dispatch(command);
    },
    [dispatch],
  );

  const selection = useMemo<OutlineSelection>(
    () => ({
      categoryId: selectedCategoryId,
      focusedId,
      selectCategory: setSelectedCategoryId,
      focusNode: setFocusedId,
    }),
    [selectedCategoryId, focusedId],
  );

  const BoardView = boardView;

  return (
    <section className="flex h-full min-h-[0px] flex-col">
      <div className="flex flex-wrap items-center gap-hsp-md border-b border-border px-hsp-xl py-vsp-xs">
        <ViewSwitch value={view} onChange={changeView} />
        <span className="ml-auto">
          <SaveChip state={surface.saveState} />
        </span>
      </div>

      <Banners surface={surface} />

      {surface.status === "loading" ? (
        <p className={`${PANE_PADDING} text-body text-muted`}>
          Loading the outline…
        </p>
      ) : model === null || snapshot === null ? (
        <div className={`${PANE_PADDING} flex flex-col items-start gap-vsp-sm`}>
          <p className="text-body text-danger">
            {surface.problem?.message ?? "The outline could not be loaded."}
          </p>
          <button
            type="button"
            onClick={() => void surface.refresh()}
            className="rounded-sm bg-accent px-hsp-md py-vsp-2xs text-small font-medium text-accent-fg hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          >
            Try again
          </button>
        </div>
      ) : view === "board" ? (
        <div className={`${PANE_PADDING} min-h-[0px] flex-1 overflow-y-auto`}>
          {BoardView === undefined ? (
            <div className="flex flex-col gap-vsp-xs rounded-md border border-dashed border-border-strong p-hsp-xl">
              <h2 className="text-title font-semibold text-fg">Board view</h2>
              <p className="text-body text-muted">
                The kanban overview of this outline lands in sub-issue #3337. It
                mounts here, under this switch, reading the same project
                snapshot and dispatching the same outline commands as the tree.
              </p>
            </div>
          ) : (
            // Local boundary: a code-split board view suspending against the
            // shell's own boundary would take the whole surface down with it.
            <Suspense
              fallback={<p className="text-body text-muted">Loading board…</p>}
            >
              <BoardView
                snapshot={snapshot}
                dispatch={dispatch}
                selection={selection}
              />
            </Suspense>
          )}
        </div>
      ) : (
        <div className="flex min-h-[0px] flex-1">
          <div
            className={`min-w-[0px] grow overflow-y-auto border-r border-border ${PANE_PADDING}`}
            style={{ flexBasis: "55%" }}
          >
            <div style={{ maxWidth: "41.25rem" }}>
              <header className="flex flex-col gap-vsp-2xs pb-vsp-md">
                <h1 className="text-title font-semibold text-fg">
                  Site structure
                </h1>
                <p className="text-caption text-muted">
                  Categories become header navigation; their pages fill the
                  sidebar. The top page is generated from this outline.
                </p>
              </header>
              <TreeView
                model={model}
                selectedCategoryId={selectedCategoryId}
                focusedId={focusedId}
                beginEditing={beginEditing}
                onSelectCategory={setSelectedCategoryId}
                onFocusNode={setFocusedId}
                onRenameCategory={(categoryId, title) =>
                  send(renameCategoryCommand(categoryId, title))
                }
                onRenamePage={(pageId, title) => void renamePage(pageId, title)}
                onSetPageSlug={(pageId, slug) =>
                  send(setPageSlugCommand(pageId, slug))
                }
                onDeleteCategory={(categoryId) =>
                  send(removeCategoryCommand(categoryId))
                }
                onDeletePage={(pageId) => send(removePageCommand(pageId))}
                onMoveCategory={(categoryId, direction) =>
                  send(moveCategory(model, categoryId, direction))
                }
                onMovePage={(categoryId, pageId, direction) =>
                  send(movePage(model, categoryId, pageId, direction))
                }
                onMovePageToCategory={(pageId, toCategoryId) =>
                  send(movePageToCategoryCommand(snapshot, pageId, toCategoryId))
                }
                onAddPage={(categoryId, title) => {
                  void dispatch(addPageCommand(categoryId, title)).then(
                    (result) => {
                      if (!result.ok || result.createdPageId === undefined) return;
                      setSelectedCategoryId(categoryId);
                      setFocusedId(result.createdPageId);
                    },
                  );
                }}
                onAddCategory={(title) => {
                  void dispatch(addCategoryCommand(title)).then((result) => {
                    if (!result.ok || typeof result.selectedId !== "string") return;
                    setSelectedCategoryId(result.selectedId);
                    setFocusedId(result.selectedId);
                  });
                }}
                getMoveTargets={(pageId) => listMoveTargets(snapshot, pageId)}
              />
            </div>
          </div>
          <aside
            className={`min-w-[0px] grow overflow-y-auto ${PANE_PADDING}`}
            style={{
              flexBasis: "45%",
              background:
                "color-mix(in oklch, var(--zdo-surface) 55%, var(--zdo-bg))",
            }}
            aria-label="Structure preview"
          >
            <SitemapPreview
              siteMap={model.siteMap}
              selectedCategoryId={selectedCategoryId}
            />
          </aside>
        </div>
      )}
    </section>
  );
}

function moveCategory(
  model: OutlineTreeModel,
  categoryId: string,
  direction: MoveDirection,
): OutlineCommand | null {
  const category = model.categories.find((entry) => entry.id === categoryId);
  return category === undefined ? null : moveCategoryCommand(category, direction);
}

function movePage(
  model: OutlineTreeModel,
  categoryId: string,
  pageId: string,
  direction: MoveDirection,
): OutlineCommand | null {
  const category = model.categories.find((entry) => entry.id === categoryId);
  const page = category?.pages.find((entry) => entry.id === pageId);
  if (category === undefined || page === undefined) return null;
  return movePageCommand(category, page, direction);
}

function nodeExists(model: OutlineTreeModel, nodeId: string): boolean {
  return model.categories.some(
    (category) =>
      category.id === nodeId ||
      category.pages.some((page) => page.id === nodeId),
  );
}

const BANNER_BASE =
  "flex flex-wrap items-center gap-hsp-md border-b px-hsp-xl py-vsp-xs text-small";

const BANNER_BUTTON =
  "rounded-sm px-hsp-md py-vsp-2xs text-caption font-medium focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

function Banners({
  surface,
}: {
  surface: ReturnType<typeof useOutlineSurface>;
}) {
  return (
    <>
      {surface.conflict === null ? null : (
        <div
          role="alert"
          className={`${BANNER_BASE} border-border bg-accent-soft text-fg`}
        >
          <span className="min-w-[0px] flex-1">
            <strong className="font-semibold">
              {surface.conflict.mutation.label} was not applied.
            </strong>{" "}
            Someone else changed this project first.{" "}
            {surface.conflict.keptDraft
              ? "Your in-progress edit is kept until you choose."
              : "The outline below is now the server's latest."}
          </span>
          <button
            type="button"
            onClick={() => void surface.retryConflict()}
            className={`${BANNER_BUTTON} bg-accent text-accent-fg hover:bg-accent-hover`}
          >
            Retry my change
          </button>
          <button
            type="button"
            onClick={surface.adoptLatest}
            className={`${BANNER_BUTTON} border border-border-strong text-fg-mild hover:text-fg`}
          >
            Adopt latest
          </button>
        </div>
      )}

      {surface.remoteChanged && surface.conflict === null ? (
        <div
          role="status"
          className={`${BANNER_BASE} border-border bg-surface text-fg-mild`}
        >
          <span className="min-w-[0px] flex-1">
            This project changed elsewhere. Your open edit is kept — the outline
            refreshes as soon as you finish it.
          </span>
          <button
            type="button"
            onClick={() => void surface.refresh()}
            className={`${BANNER_BUTTON} border border-border-strong text-fg-mild hover:text-fg`}
          >
            Refresh now
          </button>
        </div>
      ) : null}

      {surface.saveError === null ? null : (
        <p
          role="alert"
          className={`${BANNER_BASE} border-border bg-surface text-danger`}
        >
          {surface.saveError.message}
        </p>
      )}

      {surface.problem === null || surface.status !== "ready" ? null : (
        <p
          role="status"
          className={`${BANNER_BASE} border-border bg-surface text-warning`}
        >
          Could not refresh from the server: {surface.problem.message}
        </p>
      )}
    </>
  );
}

export interface SaveChipCopy {
  label: string;
  detail: string;
  tone: "neutral" | "busy" | "good" | "bad";
}

/**
 * The chip never claims more than happened: a command the server accepted
 * without changing anything reports "No change" rather than "Saved", and a
 * conflict says a decision is pending instead of going quiet.
 */
export function describeSaveState(state: OutlineSaveState): SaveChipCopy {
  switch (state) {
    case "saving":
      return { label: "Saving…", detail: "sending your change", tone: "busy" };
    case "saved":
      return { label: "Saved", detail: "structure up to date", tone: "good" };
    case "no-change":
      return {
        label: "No change",
        detail: "the outline already matched",
        tone: "neutral",
      };
    case "error":
      return { label: "Not saved", detail: "the last change failed", tone: "bad" };
    case "conflict":
      return { label: "Conflict", detail: "waiting for your decision", tone: "bad" };
    case "idle":
      return {
        label: "Up to date",
        detail: "no pending structure change",
        tone: "neutral",
      };
  }
}

const TONE_DOT: Record<SaveChipCopy["tone"], string> = {
  neutral: "bg-muted",
  busy: "bg-info",
  good: "bg-success",
  bad: "bg-danger",
};

function SaveChip({ state }: { state: OutlineSaveState }) {
  const copy = describeSaveState(state);
  return (
    <span className="flex items-center gap-hsp-sm rounded-full border border-border bg-bg px-hsp-md py-vsp-2xs text-caption text-muted">
      <span
        aria-hidden="true"
        className={`block shrink-0 rounded-full ${TONE_DOT[copy.tone]}`}
        style={{ width: "7px", height: "7px" }}
      />
      <strong className="font-semibold text-fg-mild">{copy.label}</strong>
      <span>· {copy.detail}</span>
    </span>
  );
}
