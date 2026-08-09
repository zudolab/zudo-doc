/**
 * The kanban board view (#3337) — the switchable overview mode of the
 * outline surface. Implements `OutlineViewComponent` (`view-props.ts`): it
 * reads the SAME snapshot and dispatches the SAME outline commands as the
 * tree, so switching Outline <-> Board is a pure rendering choice with no
 * separate data path. `route.tsx` discovers this file automatically —
 * nothing outside `src/features/outline/board*` needed to change.
 *
 * The interaction recipe this file follows is the distilled, battle-tested
 * pattern at `_temp-resource/3327-zudo-doc-online/references/kanban-pattern.md`
 * — read that file before changing anything here. The load-bearing pure
 * logic (working-copy relocation, drop slot precedence, sensors, collision
 * detection, keyboard column jumps) lives in `board/dnd.ts`; this file is
 * the event-handling glue that turns a drop into ONE outline command.
 */

import {
  DndContext,
  DragOverlay,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useCallback, useMemo, useRef, useState } from "preact/hooks";
import type { MoveCategoryCommand, MovePageCommand } from "../../core/outline/index.js";
import { AddCategoryGhostColumn } from "./board/composers.js";
import { BoardColumn } from "./board/board-column.js";
import {
  BOARD_DRAGGING_BODY_CLASS,
  boardCollisionDetection,
  buildColumnMap,
  CARD_DND_TYPE,
  COLUMN_BODY_DND_TYPE,
  COLUMN_DND_TYPE,
  columnSortableId,
  relocateActiveCardToColumn,
  resolveColumnMoveIndex,
  resolveDropBeforeId,
  resolveFinalColumnId,
  resolveMoveIndex,
  resolveSameColumnDropIndex,
  useBoardSensors,
  type BoardDndData,
  type BoardOverType,
  type ColumnMap,
} from "./board/dnd.js";
import { PageCardGhost } from "./board/page-card.js";
import { BOARD_COLUMN_WIDTH, BOARD_TOKEN_STYLE, boardStyleVars } from "./board/tokens.js";
import { TopPageColumn } from "./board/top-page-column.js";
import {
  addCategoryCommand,
  addPageCommand,
  moveCategoryCommand,
  movePageCommand,
  removeCategoryCommand,
  removePageCommand,
} from "./outline-actions.js";
import { buildOutlineTree, type OutlinePageRow } from "./outline-model.js";
import type { OutlineViewProps } from "./view-props.js";

const ADD_CATEGORY_KEY = "add-category";
const addPageKey = (categoryId: string): string => `add-page:${categoryId}`;

export default function BoardView({ snapshot, dispatch, selection }: OutlineViewProps) {
  const model = useMemo(() => buildOutlineTree(snapshot), [snapshot]);
  const sensors = useBoardSensors();

  const derivedMap = useMemo<ColumnMap<OutlinePageRow>>(
    () => buildColumnMap(model.categories),
    [model],
  );

  const [workingMap, setWorkingMap] = useState<ColumnMap<OutlinePageRow> | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [openComposerKey, setOpenComposerKey] = useState<string | null>(null);

  // Guards read/written synchronously inside dnd-kit's own handlers — never
  // rendered, so a ref (not state) is correct here.
  const keyboardActiveRef = useRef(false);
  const suppressClickRef = useRef(false);
  const suppressClick = useCallback(() => suppressClickRef.current, []);

  const columnSortIds = useMemo(
    () => model.categories.map((category) => columnSortableId(category.id)),
    [model],
  );

  /** Shared by `onDragEnd` and `onDragCancel` (recipe §3/§4: cancel mirrors
   * end's cleanup EXACTLY). Click suppression is cleared on the NEXT
   * macrotask, not immediately — clearing on a timer (not on drop) keeps an
   * Escape-cancelled drag from swallowing the very next genuine click. */
  const cleanupDrag = useCallback(() => {
    document.body.classList.remove(BOARD_DRAGGING_BODY_CLASS);
    setWorkingMap(null);
    setActiveCardId(null);
    setActiveColumnId(null);
    keyboardActiveRef.current = false;
    suppressClickRef.current = true;
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    keyboardActiveRef.current = event.activatorEvent instanceof KeyboardEvent;
    document.body.classList.add(BOARD_DRAGGING_BODY_CLASS);
    const data = event.active.data.current as BoardDndData | undefined;
    if (data?.type === CARD_DND_TYPE) {
      setActiveCardId(String(event.active.id));
    } else if (data?.type === COLUMN_DND_TYPE) {
      setActiveColumnId(String(event.active.id));
    }
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      // Guard (recipe §4): keyboard-activated drags never relocate — doing
      // so would remount the active node into another sortable context and
      // break the keyboard sensor's own tracking. Keyboard users get the
      // cross-column move applied at drop instead.
      if (keyboardActiveRef.current) return;

      const activeData = event.active.data.current as BoardDndData | undefined;
      if (activeData?.type !== CARD_DND_TYPE) return;

      const overId = event.over?.id ?? null;
      // Guard: the relocated placeholder still reports its ORIGINAL category
      // (card data is not mutated during drag), so acting on `over.id ===
      // active.id` would oscillate.
      if (overId === null || overId === event.active.id) return;

      const overData = event.over?.data.current as BoardDndData | undefined;
      let targetColumnId: string | null = null;
      let overCardId: string | null = null;
      if (overData?.type === CARD_DND_TYPE) {
        targetColumnId = overData.categoryId;
        overCardId = String(overId);
      } else if (overData?.type === COLUMN_BODY_DND_TYPE) {
        targetColumnId = overData.categoryId;
      }
      if (targetColumnId === null) return;

      const resolvedTargetColumnId = targetColumnId;
      setWorkingMap((current) => {
        const base = current ?? derivedMap;
        const next = relocateActiveCardToColumn(
          base,
          String(event.active.id),
          resolvedTargetColumnId,
          overCardId,
        );
        // Skip the re-render when nothing changed (recipe §4).
        return next ?? current;
      });
    },
    [derivedMap],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeData = event.active.data.current as BoardDndData | undefined;
      const overData = event.over?.data.current as BoardDndData | undefined;
      const rawOverId = event.over?.id ?? null;

      if (activeData?.type === CARD_DND_TYPE) {
        const activeId = String(event.active.id);
        const sourceColumnId = activeData.categoryId;

        let overType: BoardOverType = "none";
        let overColumnId: string | null = null;
        let overCardId: string | null = null;
        if (overData?.type === CARD_DND_TYPE) {
          overType = "card";
          overColumnId = overData.categoryId;
          overCardId = rawOverId === null ? null : String(rawOverId);
        } else if (overData?.type === COLUMN_BODY_DND_TYPE) {
          overType = "columnBody";
          overColumnId = overData.categoryId;
        }

        // A pure same-column drag never builds a working copy (relocation
        // returns null on same-column hover), and in that case trusting
        // `over` directly via "insert before" is directional — dragging
        // downward onto an OTHER card resolves back to the active card's
        // own starting index (codex-review finding). Resolve those drops
        // straight from ORIGINAL positions instead, before the general
        // working-copy-aware pipeline below (which stays correct for
        // every cross-column case, including a working copy that ends up
        // back in the source column after an out-and-back-in drag).
        if (workingMap === null && overType === "card" && overColumnId === sourceColumnId) {
          const sameColumn = model.categories.find(
            (category) => category.id === sourceColumnId,
          );
          const toIndex = resolveSameColumnDropIndex(
            sameColumn?.pages.map((page) => page.id) ?? [],
            activeId,
            overCardId,
          );
          if (toIndex !== null) {
            const command: MovePageCommand = {
              type: "move-page",
              pageId: activeId,
              toCategoryId: sourceColumnId,
              toIndex,
            };
            void dispatch(command);
          }
          cleanupDrag();
          return;
        }

        // Commit from the working copy, not from `over` (recipe §4): at
        // release the pointer usually sits on the relocated placeholder,
        // whose category data is stale.
        const finalColumnId = resolveFinalColumnId({
          workingMap,
          activeId,
          sourceColumnId,
          overType,
          overColumnId,
        });
        const beforeId = resolveDropBeforeId({
          finalColumnId,
          workingMap,
          activeId,
          overId: overCardId,
          overType,
        });
        const targetCategory = model.categories.find(
          (category) => category.id === finalColumnId,
        );
        const sourceCategory = model.categories.find(
          (category) => category.id === sourceColumnId,
        );

        if (targetCategory !== undefined && sourceCategory !== undefined) {
          const toIndex = resolveMoveIndex(
            targetCategory.pages.map((page) => page.id),
            activeId,
            beforeId,
          );
          const fromIndex = sourceCategory.pages.findIndex((page) => page.id === activeId);
          // One mutation per drop, and only when something actually moved
          // (recipe §4): a same-column drop that lands back where it
          // started emits nothing.
          const unchanged = finalColumnId === sourceColumnId && toIndex === fromIndex;
          if (!unchanged) {
            const command: MovePageCommand = {
              type: "move-page",
              pageId: activeId,
              toCategoryId: finalColumnId,
              toIndex,
            };
            void dispatch(command);
          }
        }
      } else if (activeData?.type === COLUMN_DND_TYPE) {
        const toIndex = resolveColumnMoveIndex(
          columnSortIds,
          String(event.active.id),
          rawOverId === null ? null : String(rawOverId),
        );
        if (toIndex !== null) {
          const command: MoveCategoryCommand = {
            type: "move-category",
            categoryId: activeData.categoryId,
            toIndex,
          };
          void dispatch(command);
        }
      }

      cleanupDrag();
    },
    [workingMap, model, dispatch, cleanupDrag, columnSortIds],
  );

  const handleDragCancel = useCallback((_event: DragCancelEvent) => {
    cleanupDrag();
  }, [cleanupDrag]);

  const activeCard = useMemo<OutlinePageRow | null>(() => {
    if (activeCardId === null) return null;
    for (const category of model.categories) {
      const found = category.pages.find((page) => page.id === activeCardId);
      if (found !== undefined) return found;
    }
    return null;
  }, [activeCardId, model]);

  const activeColumn = useMemo(() => {
    if (activeColumnId === null) return null;
    return model.categories.find((category) => category.id === activeColumnId) ?? null;
  }, [activeColumnId, model]);

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-vsp-sm"
      style={boardStyleVars(BOARD_TOKEN_STYLE)}
    >
      <header className="flex flex-col gap-vsp-2xs">
        <h1 className="text-title font-semibold text-fg">Site structure</h1>
        <p className="text-caption text-muted">
          {model.categories.length === 1
            ? "1 category"
            : `${model.categories.length} categories`}{" "}
          ·{" "}
          {model.topPage.pageCount === 1
            ? "1 page"
            : `${model.topPage.pageCount} pages`}
        </p>
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 items-stretch gap-hsp-md overflow-x-auto overflow-y-hidden pb-vsp-xs">
          <DndContext
            sensors={sensors}
            collisionDetection={boardCollisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <TopPageColumn topPage={model.siteMap.topPage} />

            {model.categories.map((category) => {
              const pages = workingMap?.get(category.id) ?? category.pages;
              const composerKey = addPageKey(category.id);
              return (
                <BoardColumn
                  key={category.id}
                  category={category}
                  pages={pages}
                  canMoveLeft={category.canMoveUp}
                  canMoveRight={category.canMoveDown}
                  suppressClick={suppressClick}
                  isComposerOpen={openComposerKey === composerKey}
                  onOpenComposer={() => setOpenComposerKey(composerKey)}
                  onCloseComposer={() =>
                    setOpenComposerKey((current) => (current === composerKey ? null : current))
                  }
                  onAddPage={(title) => {
                    void dispatch(addPageCommand(category.id, title)).then((result) => {
                      if (!result.ok || result.createdPageId === undefined) return;
                      selection.selectCategory(category.id);
                      selection.focusNode(result.createdPageId);
                    });
                  }}
                  onMoveColumn={(direction) => {
                    const command = moveCategoryCommand(category, direction);
                    if (command !== null) void dispatch(command);
                  }}
                  onOpenPage={(pageId) => {
                    selection.selectCategory(category.id);
                    selection.focusNode(pageId);
                  }}
                  onMovePage={(pageId, direction) => {
                    const page = category.pages.find((entry) => entry.id === pageId);
                    if (page === undefined) return;
                    const command = movePageCommand(category, page, direction);
                    if (command !== null) void dispatch(command);
                  }}
                  onDeletePage={(pageId) => {
                    void dispatch(removePageCommand(pageId));
                  }}
                  onDeleteColumn={() => {
                    void dispatch(removeCategoryCommand(category.id));
                  }}
                />
              );
            })}

            <AddCategoryGhostColumn
              isOpen={openComposerKey === ADD_CATEGORY_KEY}
              onOpen={() => setOpenComposerKey(ADD_CATEGORY_KEY)}
              onClose={() =>
                setOpenComposerKey((current) => (current === ADD_CATEGORY_KEY ? null : current))
              }
              onAdd={(title) => {
                void dispatch(addCategoryCommand(title)).then((result) => {
                  if (!result.ok || typeof result.selectedId !== "string") return;
                  selection.selectCategory(result.selectedId);
                  selection.focusNode(result.selectedId);
                });
              }}
            />

            <DragOverlay style={boardStyleVars(BOARD_TOKEN_STYLE)}>
              {activeCard !== null ? <PageCardGhost page={activeCard} /> : null}
              {activeColumn !== null ? (
                <div
                  className="rounded-[var(--zdo-kb-column-radius,var(--radius-md))] border px-hsp-sm py-vsp-xs text-small font-semibold text-fg shadow-[var(--shadow-2)]"
                  style={{
                    transform: "rotate(1.5deg)",
                    width: BOARD_COLUMN_WIDTH,
                    backgroundColor: "var(--zdo-kb-column-bg, var(--zdo-surface-2))",
                    borderColor: "var(--zdo-accent)",
                  }}
                >
                  {activeColumn.title}
                  <span className="ml-hsp-xs font-normal text-muted">
                    {activeColumn.pageCount === 1
                      ? "1 page"
                      : `${activeColumn.pageCount} pages`}
                  </span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      <p className="text-caption text-muted">
        Drag a card to reorder or move it between categories, or drag a
        column header to reorder categories. Every card and column header is
        keyboard-reachable: focus its grip, press Space to lift, arrow keys
        to move, Space to drop.
      </p>
    </div>
  );
}
