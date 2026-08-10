/**
 * One category column — sortable (drag the header to reorder columns) and a
 * droppable card list (recipe §§1-4).
 *
 * The column body is BOTH the scroll container and the droppable, with a
 * trailing `flex-1` spacer so an EMPTY column still has droppable area below
 * its (absent) last card — recipe §1's answer to "how does an empty column
 * accept a drop" without min-height hacks or empty-state art.
 *
 * The header visually reads as the whole column's drag handle
 * (`cursor-grab`, matching the accepted prototype), but the actual dnd-kit
 * `listeners` attach only to a dedicated grip button inside it — the same
 * split cards use (`page-card.tsx`), and for the same reason: spreading
 * `listeners`' `onKeyDown` across an element that also hosts the delete
 * button would let Space/Enter on that button bubble into the keyboard
 * sensor's own lift activator (recipe §5's inline-input warning applies
 * equally to any nested interactive control, not just text inputs).
 */

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "preact/hooks";
import { ArrowDownIcon, ArrowUpIcon, GripIcon, TrashIcon } from "../icons.js";
import { InlineConfirm } from "../inline-confirm.js";
import { describeCategoryDelete, type MoveDirection } from "../outline-actions.js";
import type { OutlineCategoryRow, OutlinePageRow } from "../outline-model.js";
import { AddPageComposer } from "./composers.js";
import {
  columnBodyDroppableId,
  columnSortableId,
  COLUMN_BODY_DND_TYPE,
  COLUMN_DND_TYPE,
  type ColumnBodyDndData,
  type ColumnDndData,
} from "./dnd.js";
import { PageCard } from "./page-card.js";
import { BOARD_COLUMN_WIDTH } from "./tokens.js";

const COLUMN_ROOT =
  "flex min-h-0 shrink-0 flex-col self-stretch rounded-[var(--zdo-kb-column-radius,var(--radius-md))] border border-border";

const COLUMN_HEADER = "flex shrink-0 cursor-grab items-center gap-hsp-xs px-hsp-xs py-vsp-2xs";

const GRIP_BUTTON =
  "flex shrink-0 items-center justify-center rounded-sm p-hsp-2xs text-muted hover:bg-surface-2 hover:text-fg-mild focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 active:cursor-grabbing";

const SLUG_CHIP =
  "shrink-0 rounded-sm bg-surface px-hsp-sm py-vsp-2xs font-mono text-caption text-muted";

const COUNT_CHIP =
  "shrink-0 rounded-full bg-surface px-hsp-sm py-vsp-2xs text-caption font-semibold text-muted";

const ICON_BUTTON =
  "shrink-0 rounded-sm p-hsp-2xs text-muted hover:bg-surface hover:text-fg disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const DANGER_ICON_BUTTON =
  "shrink-0 rounded-sm p-hsp-2xs text-muted hover:bg-surface hover:text-danger focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

export interface BoardColumnProps {
  /** The project this outline belongs to — threaded to each card's editor link (#3347). */
  projectSlug: string;
  category: OutlineCategoryRow;
  /** The card list to render — the working copy during a cross-column drag,
   * the derived model otherwise (`board-view.tsx` decides which). */
  pages: readonly OutlinePageRow[];
  canMoveLeft: boolean;
  canMoveRight: boolean;
  suppressClick(): boolean;
  isComposerOpen: boolean;
  onOpenComposer(): void;
  onCloseComposer(): void;
  onAddPage(title: string): void;
  onMoveColumn(direction: MoveDirection): void;
  onOpenPage(pageId: string): void;
  onMovePage(pageId: string, direction: MoveDirection): void;
  onDeletePage(pageId: string): void;
  onDeleteColumn(): void;
  /** Optional — see the identical note on `PageCardProps.beginEditing`. */
  beginEditing?: (() => () => void) | undefined;
}

export function BoardColumn({
  projectSlug,
  category,
  pages,
  canMoveLeft,
  canMoveRight,
  suppressClick,
  isComposerOpen,
  onOpenComposer,
  onCloseComposer,
  onAddPage,
  onMoveColumn,
  onOpenPage,
  onMovePage,
  onDeletePage,
  onDeleteColumn,
  beginEditing,
}: BoardColumnProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef: setSortableNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: columnSortableId(category.id),
    data: { type: COLUMN_DND_TYPE, categoryId: category.id } satisfies ColumnDndData,
  });

  const { setNodeRef: setDroppableNodeRef } = useDroppable({
    id: columnBodyDroppableId(category.id),
    data: { type: COLUMN_BODY_DND_TYPE, categoryId: category.id } satisfies ColumnBodyDndData,
  });

  // dnd-kit's `DraggableAttributes.role` is a plain `string`, narrower than
  // Preact's `Signalish<AriaRole>` prop type — cast the spread rather than
  // widen Preact's own JSX types (mirrors the bootstrap dnd spike).
  const dndAttributes = attributes as unknown as Record<string, unknown>;
  const dragHandleProps = listeners as unknown as Record<string, unknown> | undefined;

  const rootStyle = {
    width: BOARD_COLUMN_WIDTH,
    minWidth: BOARD_COLUMN_WIDTH,
    backgroundColor: "var(--zdo-kb-column-bg, var(--zdo-surface-2))",
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    opacity: isDragging ? 0.5 : undefined,
  };

  const pageIds = pages.map((page) => page.id);

  return (
    <section
      ref={setSortableNodeRef}
      style={rootStyle}
      {...dndAttributes}
      aria-label={`Category: ${category.title}`}
      className={COLUMN_ROOT}
    >
      <header className={COLUMN_HEADER}>
        <button
          ref={setActivatorNodeRef}
          {...dragHandleProps}
          type="button"
          data-dnd-activator
          aria-label={`Drag to reorder ${category.title}`}
          className={GRIP_BUTTON}
        >
          <GripIcon size="sm" />
        </button>
        <span className={SLUG_CHIP}>{category.slug}/</span>
        <span className={COUNT_CHIP}>{category.pageCount}</span>
        <span className="ml-auto flex shrink-0 items-center gap-hsp-2xs">
          <button
            type="button"
            disabled={!canMoveLeft}
            onClick={() => onMoveColumn("up")}
            aria-label={`Move ${category.title} left`}
            className={`${ICON_BUTTON} -rotate-90`}
          >
            <ArrowUpIcon />
          </button>
          <button
            type="button"
            disabled={!canMoveRight}
            onClick={() => onMoveColumn("down")}
            aria-label={`Move ${category.title} right`}
            className={`${ICON_BUTTON} -rotate-90`}
          >
            <ArrowDownIcon />
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Delete category ${category.title}`}
            className={DANGER_ICON_BUTTON}
          >
            <TrashIcon />
          </button>
        </span>
      </header>

      <p className="truncate px-hsp-sm pb-vsp-2xs text-small font-semibold text-fg">
        {category.title}
      </p>

      {confirmingDelete ? (
        <div className="px-hsp-sm pb-vsp-sm">
          <InlineConfirm
            message={describeCategoryDelete(category)}
            confirmLabel="Delete category"
            tone="danger"
            beginEditing={beginEditing}
            onConfirm={() => {
              setConfirmingDelete(false);
              onDeleteColumn();
            }}
            onCancel={() => setConfirmingDelete(false)}
          />
        </div>
      ) : null}

      <div
        ref={setDroppableNodeRef}
        className="flex min-h-0 flex-1 flex-col gap-vsp-2xs overflow-y-auto overscroll-y-contain px-hsp-sm pb-hsp-sm"
      >
        <SortableContext items={pageIds} strategy={verticalListSortingStrategy}>
          <ul className="flex min-w-[0px] flex-col gap-vsp-2xs">
            {pages.map((page, index) => (
              <PageCard
                key={page.id}
                projectSlug={projectSlug}
                page={page}
                categoryId={category.id}
                categoryTitle={category.title}
                canMoveUp={index > 0}
                canMoveDown={index < pages.length - 1}
                suppressClick={suppressClick}
                onOpen={() => onOpenPage(page.id)}
                onMove={(direction) => onMovePage(page.id, direction)}
                onDelete={() => onDeletePage(page.id)}
                beginEditing={beginEditing}
              />
            ))}
          </ul>
        </SortableContext>

        <AddPageComposer
          categoryTitle={category.title}
          isOpen={isComposerOpen}
          onOpen={onOpenComposer}
          onClose={onCloseComposer}
          onAdd={onAddPage}
        />

        {/* The empty-column answer (recipe §1): this spacer swells to fill
         * the remainder, so the whole area below the last card stays inside
         * the droppable rect even when the column holds zero cards. */}
        <div aria-hidden="true" className="min-h-0 flex-1" />
      </div>
    </section>
  );
}
