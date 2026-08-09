/**
 * The board's dnd-kit wiring plus the pure "drag plan" functions the recipe
 * calls the load-bearing part. Everything below follows
 * `_temp-resource/3327-zudo-doc-online/references/kanban-pattern.md` §§3-5 —
 * read that file before changing anything here.
 *
 * Two families live in this module:
 *
 * - **Pure functions** (`relocateActiveCardToColumn`, `findCardColumn`,
 *   `resolveFinalColumnId`, `resolveDropBeforeId`, `resolveMoveIndex`,
 *   `resolveColumnMoveIndex`, `isActivatingElement`): no dnd-kit types, no
 *   DOM, exhaustively unit-tested in `__tests__/dnd.test.ts`. These decide
 *   WHAT a drop commits — the actual mutation is one `move-page` or
 *   `move-category` command built from their output.
 * - **dnd-kit config** (sensors, collision detection, keyboard coordinate
 *   getter, id/data helpers): the wiring `board-view.tsx` hands to
 *   `<DndContext>`. This half is exercised by jsdom mount tests plus the
 *   manager's browser-verification pass — jsdom cannot simulate a real
 *   pointer drag.
 *
 * ## Id namespaces (recipe §3)
 *
 * - A page card's draggable/sortable id is its raw page id (no prefix), data
 *   `{ type: "card", categoryId }`.
 * - A column's CARD-LIST droppable (the body — the scroll container AND the
 *   thing an empty column still accepts drops on) is `column:<categoryId>`,
 *   data `{ type: "columnBody", categoryId }`. This is a plain `useDroppable`
 *   target, not the same thing as the column's own drag handle below.
 * - A column's own sortable (dragging the COLUMN to reorder it) is
 *   `column-sort:<categoryId>`, data `{ type: "column", categoryId }`.
 *
 * Two different "column" data types exist on purpose: the collision-
 * detection cascade filters droppables by the ACTIVE drag's type (recipe
 * §3), and a card drag must only ever collide with `card` / `columnBody`
 * droppables while a column drag must only ever collide with `column`
 * droppables — conflating the two would let a card "land on" another
 * column's drag handle.
 *
 * ## Cross-column move semantics (recipe §4)
 *
 * `relocateActiveCardToColumn` maintains the drag-time WORKING COPY —
 * called on every `dragover`, skipped for keyboard-activated drags and when
 * `over.id === active.id` (both guards live in `board-view.tsx`, which owns
 * the dnd-kit event handlers; this module only computes, it never decides
 * whether to call itself).
 *
 * At drop, `resolveFinalColumnId` + `resolveDropBeforeId` + `resolveMoveIndex`
 * together implement "commit from the working copy, not from `over`": the
 * working copy (when one exists) is authoritative for which column the card
 * ends up in, and slot precedence prefers a genuine other card in that final
 * column, then the working copy's own next neighbour, then append.
 */

import type {
  CollisionDetection,
  DroppableContainer,
  KeyboardCoordinateGetter,
  PointerSensorOptions,
  TouchSensorOptions,
} from "@dnd-kit/core";
import {
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

// ---------------------------------------------------------------------------
// Pure drag-plan functions
// ---------------------------------------------------------------------------

export interface BoardCard {
  id: string;
}

/** `Map<categoryId, cards>` — the shape both the derived model and the
 * drag-time working copy share. Readonly so a caller cannot mutate a
 * "previous state" reference handed back for a no-op dragover. */
export type ColumnMap<T extends BoardCard = BoardCard> = ReadonlyMap<
  string,
  readonly T[]
>;

/** Builds the derived (non-drag) column map straight from the outline model. */
export function buildColumnMap<T extends BoardCard>(
  categories: ReadonlyArray<{ id: string; pages: readonly T[] }>,
): ColumnMap<T> {
  return new Map(categories.map((category) => [category.id, category.pages]));
}

/** Which column (per `map`) currently holds `cardId`, or null if none does. */
export function findCardColumn<T extends BoardCard>(
  map: ColumnMap<T>,
  cardId: string,
): string | null {
  for (const [columnId, cards] of map) {
    if (cards.some((card) => card.id === cardId)) return columnId;
  }
  return null;
}

/**
 * Recipe §4's relocation trick: moves `activeId` into `targetColumnId`
 * inside a NEW map, or returns null when nothing should change.
 *
 * - Same-column hover (the active card's current column, per `map`, already
 *   equals `targetColumnId`) returns null — a within-column gap is the
 *   sortable strategy's job, not this function's.
 * - `overCardId` null means "append to the end of the target column";
 *   otherwise the active card is inserted BEFORE that card.
 * - Returns null (rather than an identical-looking new map) whenever the
 *   caller should skip a re-render because nothing actually moved.
 */
export function relocateActiveCardToColumn<T extends BoardCard>(
  map: ColumnMap<T>,
  activeId: string,
  targetColumnId: string,
  overCardId: string | null,
): Map<string, T[]> | null {
  const sourceColumnId = findCardColumn(map, activeId);
  if (sourceColumnId === null) return null;
  if (sourceColumnId === targetColumnId) return null;

  let activeCard: T | undefined;
  for (const card of map.get(sourceColumnId) ?? []) {
    if (card.id === activeId) {
      activeCard = card;
      break;
    }
  }
  if (activeCard === undefined) return null;

  const next = new Map<string, T[]>();
  for (const [columnId, cards] of map) {
    if (columnId === sourceColumnId) {
      next.set(columnId, cards.filter((card) => card.id !== activeId));
    } else if (columnId === targetColumnId) {
      next.set(columnId, insertCard(cards, activeCard, overCardId));
    } else {
      next.set(columnId, [...cards]);
    }
  }
  if (!next.has(targetColumnId)) {
    next.set(targetColumnId, insertCard([], activeCard, overCardId));
  }
  return next;
}

function insertCard<T extends BoardCard>(
  cards: readonly T[],
  card: T,
  beforeId: string | null,
): T[] {
  const withoutActive = cards.filter((entry) => entry.id !== card.id);
  if (beforeId === null) return [...withoutActive, card];
  const index = withoutActive.findIndex((entry) => entry.id === beforeId);
  if (index === -1) return [...withoutActive, card];
  return [...withoutActive.slice(0, index), card, ...withoutActive.slice(index)];
}

export type BoardOverType = "card" | "columnBody" | "column" | "none";

/**
 * The "final column" a drop commits into. When a working copy exists it is
 * authoritative (recipe §4: never trust a stale `over`); otherwise (a
 * keyboard drag never builds one, per the guard in `board-view.tsx`) the
 * final `over` is trustworthy on its own, since nothing was ever relocated
 * out from under it.
 */
export function resolveFinalColumnId<T extends BoardCard>(params: {
  workingMap: ColumnMap<T> | null;
  activeId: string;
  sourceColumnId: string;
  overType: BoardOverType;
  /** The column a `card`/`columnBody` `over` belongs to, resolved by the caller. */
  overColumnId: string | null;
}): string {
  const { workingMap, activeId, sourceColumnId, overType, overColumnId } = params;
  if (workingMap !== null) {
    return findCardColumn(workingMap, activeId) ?? sourceColumnId;
  }
  if (overType !== "none" && overColumnId !== null) return overColumnId;
  return sourceColumnId;
}

/**
 * Slot precedence at drop (recipe §4): (1) the final `over` if it is a real
 * OTHER card that actually belongs to the final column; (2) else the working
 * copy's own next neighbour after the active card; (3) else append (null).
 */
export function resolveDropBeforeId<T extends BoardCard>(params: {
  finalColumnId: string;
  /** Null for a keyboard drag, which never builds a working copy. */
  workingMap: ColumnMap<T> | null;
  activeId: string;
  overId: string | null;
  overType: BoardOverType;
}): string | null {
  const { finalColumnId, workingMap, activeId, overId, overType } = params;

  if (overType === "card" && overId !== null && overId !== activeId) {
    if (workingMap === null) return overId;
    const finalColumnCards = workingMap.get(finalColumnId) ?? [];
    if (finalColumnCards.some((card) => card.id === overId)) return overId;
  }

  if (workingMap !== null) {
    const cards = workingMap.get(finalColumnId) ?? [];
    const index = cards.findIndex((card) => card.id === activeId);
    const neighbor = index === -1 ? undefined : cards[index + 1];
    if (neighbor !== undefined) return neighbor.id;
  }

  return null;
}

/**
 * `move-page`'s `toIndex`, expressed the way the outline core reads it: the
 * page vacates its current slot BEFORE `beforeId` is looked up (mirrors the
 * convention documented in `outline-actions.ts`), which is why filtering the
 * active id out of `targetPageIds` first is correct for BOTH a same-category
 * reorder and a cross-category move.
 */
export function resolveMoveIndex(
  targetPageIds: readonly string[],
  activeId: string,
  beforeId: string | null,
): number {
  const withoutActive = targetPageIds.filter((id) => id !== activeId);
  if (beforeId === null) return withoutActive.length;
  const index = withoutActive.indexOf(beforeId);
  return index === -1 ? withoutActive.length : index;
}

/**
 * `move-category`'s `toIndex` for a column DRAG (button-based column moves
 * reuse `moveCategoryCommand` from `outline-actions.ts` directly and never
 * call this). `move-category` also vacates-then-inserts (`commands.ts`), so
 * `overId`'s ORIGINAL index in `columnIds` is exactly the value to send —
 * the same convention `arrayMove` uses. Null means "no-op, do not dispatch".
 */
export function resolveColumnMoveIndex(
  columnIds: readonly string[],
  activeId: string,
  overId: string | null,
): number | null {
  if (overId === null || overId === activeId) return null;
  const from = columnIds.indexOf(activeId);
  const to = columnIds.indexOf(overId);
  if (from === -1 || to === -1 || from === to) return null;
  return to;
}

/**
 * Activation gating shared by pointer and touch sensors (recipe §3): an
 * explicit `[data-dnd-activator]` wins outright; otherwise a click on an
 * interactive descendant (button, link, form control, or anything opted out
 * via `[data-no-dnd]`) never starts a drag. Cards attach `listeners` only to
 * their dedicated grip handle, so this mostly matters for the column header,
 * which IS the whole drag handle but also hosts a delete button.
 */
export function isActivatingElement(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest("[data-dnd-activator]") !== null) return true;
  return target.closest("button, input, textarea, select, a, img, [data-no-dnd]") === null;
}

// ---------------------------------------------------------------------------
// dnd-kit wiring
// ---------------------------------------------------------------------------

export const CARD_DND_TYPE = "card";
export const COLUMN_BODY_DND_TYPE = "columnBody";
export const COLUMN_DND_TYPE = "column";

export interface CardDndData {
  type: typeof CARD_DND_TYPE;
  categoryId: string;
}
export interface ColumnBodyDndData {
  type: typeof COLUMN_BODY_DND_TYPE;
  categoryId: string;
}
export interface ColumnDndData {
  type: typeof COLUMN_DND_TYPE;
  categoryId: string;
}
export type BoardDndData = CardDndData | ColumnBodyDndData | ColumnDndData;

const COLUMN_BODY_PREFIX = "column:";
const COLUMN_SORT_PREFIX = "column-sort:";

export function columnBodyDroppableId(categoryId: string): string {
  return `${COLUMN_BODY_PREFIX}${categoryId}`;
}

export function columnSortableId(categoryId: string): string {
  return `${COLUMN_SORT_PREFIX}${categoryId}`;
}

/**
 * `PointerSensor` restricted to mouse/pen (recipe §3): touch is deliberately
 * excluded here so it falls through to the long-press `TouchSensor` instead
 * — otherwise a horizontal swipe-scroll on a touch device would start a drag.
 */
class BoardPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: (
        { nativeEvent: event }: { nativeEvent: PointerEvent },
        { onActivation }: PointerSensorOptions,
      ) => {
        if (event.pointerType === "touch") return false;
        if (!event.isPrimary || event.button !== 0) return false;
        if (!isActivatingElement(event.target)) return false;
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

/** Long-press touch activation (recipe §3), with the same gating. */
class BoardTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: "onTouchStart" as const,
      handler: (
        { nativeEvent: event }: { nativeEvent: TouchEvent },
        { onActivation }: TouchSensorOptions,
      ) => {
        if (event.touches.length > 1) return false;
        if (!isActivatingElement(event.target)) return false;
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

export function useBoardSensors() {
  return useSensors(
    useSensor(BoardPointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(BoardTouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: boardKeyboardCoordinateGetter }),
  );
}

function droppableType(container: DroppableContainer): string | undefined {
  const data = container.data.current as BoardDndData | undefined;
  return data?.type;
}

/**
 * `pointerWithin → rectIntersection → closestCorners`, over droppables
 * pre-filtered by the ACTIVE drag's type (recipe §3): a card drag only ever
 * considers `card` / `columnBody` droppables, a column drag only `column`
 * droppables. The cascade matters for keyboard: with no pointer,
 * `pointerWithin` returns nothing, so only an overlap test (`closestCorners`)
 * can reach a tall EMPTY column.
 */
export const boardCollisionDetection: CollisionDetection = (args) => {
  const activeType = (args.active.data.current as BoardDndData | undefined)?.type;
  const filtered = args.droppableContainers.filter((container) => {
    const type = droppableType(container);
    return activeType === COLUMN_DND_TYPE
      ? type === COLUMN_DND_TYPE
      : type === CARD_DND_TYPE || type === COLUMN_BODY_DND_TYPE;
  });
  const filteredArgs = { ...args, droppableContainers: filtered };

  const pointerHits = pointerWithin(filteredArgs);
  if (pointerHits.length > 0) return pointerHits;

  const rectHits = rectIntersection(filteredArgs);
  if (rectHits.length > 0) return rectHits;

  return closestCorners(filteredArgs);
};

/**
 * ←/→ jump to the ADJACENT column droppable by `rect.left` (recipe §5) —
 * the default nearest-droppable ranking can otherwise make the first ←/→
 * silently do nothing. ↑/↓ fall through to the standard sortable getter.
 */
export const boardKeyboardCoordinateGetter: KeyboardCoordinateGetter = (
  event,
  args,
) => {
  if (event.code !== "ArrowLeft" && event.code !== "ArrowRight") {
    return sortableKeyboardCoordinates(event, args);
  }

  // Prevent the default (page/viewport scroll) for every relevant arrow
  // press during an active drag, matching dnd-kit's own
  // `sortableKeyboardCoordinates` — unconditionally, not only once a valid
  // adjacent column is found.
  event.preventDefault();

  const { context } = args;
  const collisionRect = context.collisionRect;
  if (collisionRect === null) return undefined;

  const columns = context.droppableContainers
    .toArray()
    .filter((container) => droppableType(container) === COLUMN_DND_TYPE)
    .map((container) => ({
      container,
      rect: context.droppableRects.get(container.id),
    }))
    .filter(
      (entry): entry is { container: DroppableContainer; rect: NonNullable<typeof entry.rect> } =>
        entry.rect !== undefined,
    )
    .sort((a, b) => a.rect.left - b.rect.left);

  if (columns.length === 0) return undefined;

  let currentIndex = 0;
  for (let index = 0; index < columns.length; index += 1) {
    const entry = columns[index];
    if (entry !== undefined && entry.rect.left <= collisionRect.left) {
      currentIndex = index;
    }
  }

  const targetIndex = event.code === "ArrowLeft" ? currentIndex - 1 : currentIndex + 1;
  const target = columns[targetIndex];
  if (target === undefined) return undefined;

  return { x: target.rect.left, y: target.rect.top };
};

/** Toggled on `document.body` for the duration of any board drag (recipe §3). */
export const BOARD_DRAGGING_BODY_CLASS = "zdo-kb-dragging";
