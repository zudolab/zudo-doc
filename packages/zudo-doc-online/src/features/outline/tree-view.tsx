/**
 * The indented tree: derived top page, then one group per category, then the
 * add-category row.
 *
 * The tree holds only presentation state — which categories are collapsed and
 * which add-row is open. Structure state is always read straight from the
 * model the surface passed down, so an SSE-driven refresh or a conflict
 * rebase shows up here without this component doing anything.
 *
 * Collapse state is keyed by category id and deliberately NOT persisted: it
 * is a reading aid for the session, and restoring a stale collapse map after
 * an agent restructured the project would hide exactly the categories that
 * changed.
 */

import { useState } from "preact/hooks";
import { PlusIcon } from "./icons.js";
import { InlineEditField } from "./inline-edit-field.js";
import type { MoveDirection } from "./outline-actions.js";
import type { MoveTarget, OutlineTreeModel } from "./outline-model.js";
import { CategoryRow, PageRow, TopPageRow } from "./tree-row.js";

export interface TreeViewProps {
  model: OutlineTreeModel;
  selectedCategoryId: string | null;
  focusedId: string | null;
  onSelectCategory(categoryId: string | null): void;
  onFocusNode(nodeId: string | null): void;
  onRenameCategory(categoryId: string, title: string): void;
  onRenamePage(pageId: string, title: string): void;
  onSetPageSlug(pageId: string, slug: string): void;
  onDeleteCategory(categoryId: string): void;
  onDeletePage(pageId: string): void;
  onMoveCategory(categoryId: string, direction: MoveDirection): void;
  onMovePage(categoryId: string, pageId: string, direction: MoveDirection): void;
  onMovePageToCategory(pageId: string, toCategoryId: string): void;
  onAddPage(categoryId: string, title: string): void;
  onAddCategory(title: string): void;
  getMoveTargets(pageId: string): MoveTarget[];
  beginEditing(): () => void;
}

const ADD_ROW =
  "flex w-full min-w-[0px] items-center gap-hsp-sm rounded-md px-hsp-sm py-vsp-xs text-left text-caption text-muted hover:bg-surface hover:text-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

export function TreeView({
  model,
  selectedCategoryId,
  focusedId,
  onSelectCategory,
  onFocusNode,
  onRenameCategory,
  onRenamePage,
  onSetPageSlug,
  onDeleteCategory,
  onDeletePage,
  onMoveCategory,
  onMovePage,
  onMovePageToCategory,
  onAddPage,
  onAddCategory,
  getMoveTargets,
  beginEditing,
}: TreeViewProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [addingPageIn, setAddingPageIn] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);

  function toggleCollapsed(categoryId: string): void {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(categoryId)) next.add(categoryId);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-vsp-2xs">
      <TopPageRow
        topPage={model.topPage}
        selected={selectedCategoryId === null}
        onSelect={() => {
          onSelectCategory(null);
          onFocusNode(null);
        }}
      />

      {model.categories.map((category) => {
        const expanded = !collapsed.has(category.id);
        return (
          <div key={category.id} className="flex flex-col gap-vsp-2xs">
            <CategoryRow
              category={category}
              selected={selectedCategoryId === category.id}
              expanded={expanded}
              beginEditing={beginEditing}
              onToggleExpanded={() => toggleCollapsed(category.id)}
              onSelect={() => {
                onSelectCategory(category.id);
                onFocusNode(category.id);
              }}
              onRename={(title) => onRenameCategory(category.id, title)}
              onDelete={() => onDeleteCategory(category.id)}
              onMove={(direction) => onMoveCategory(category.id, direction)}
            />
            {expanded ? (
              <div className="ml-hsp-lg flex flex-col gap-vsp-2xs border-l border-border pl-hsp-md">
                {category.pages.map((page) => (
                  <PageRow
                    key={page.id}
                    page={page}
                    categoryTitle={category.title}
                    focused={focusedId === page.id}
                    beginEditing={beginEditing}
                    getMoveTargets={() => getMoveTargets(page.id)}
                    onFocus={() => {
                      onSelectCategory(category.id);
                      onFocusNode(page.id);
                    }}
                    onRename={(title) => onRenamePage(page.id, title)}
                    onSlugChange={(slug) => onSetPageSlug(page.id, slug)}
                    onDelete={() => onDeletePage(page.id)}
                    onMove={(direction) => onMovePage(category.id, page.id, direction)}
                    onMoveToCategory={(toCategoryId) =>
                      onMovePageToCategory(page.id, toCategoryId)
                    }
                  />
                ))}
                {addingPageIn === category.id ? (
                  <div className="flex min-w-[0px] items-center gap-hsp-sm px-hsp-sm py-vsp-2xs">
                    <InlineEditField
                      label={`Title of the new page in ${category.title}`}
                      initialValue=""
                      placeholder="Page title"
                      saveLabel="Add page"
                      beginEditing={beginEditing}
                      onCommit={(title) => {
                        setAddingPageIn(null);
                        onAddPage(category.id, title);
                      }}
                      onCancel={() => setAddingPageIn(null)}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className={ADD_ROW}
                    onClick={() => setAddingPageIn(category.id)}
                  >
                    <PlusIcon />
                    Add page to {category.title}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        );
      })}

      {addingCategory ? (
        <div className="flex min-w-[0px] items-center gap-hsp-sm px-hsp-sm py-vsp-xs">
          <InlineEditField
            label="Title of the new category"
            initialValue=""
            placeholder="Category title"
            saveLabel="Add category"
            beginEditing={beginEditing}
            onCommit={(title) => {
              setAddingCategory(false);
              onAddCategory(title);
            }}
            onCancel={() => setAddingCategory(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          className={`${ADD_ROW} justify-center border border-dashed border-border-strong font-medium`}
          onClick={() => setAddingCategory(true)}
        >
          <PlusIcon />
          Add category
        </button>
      )}

      <p className="flex flex-wrap items-center gap-hsp-lg px-hsp-sm pt-vsp-sm text-caption text-muted">
        <span className="flex items-center gap-hsp-xs">
          <span
            aria-hidden="true"
            className="block rounded-full bg-warning size-(--icon-xs)"
          />
          draft — not published yet
        </span>
        <span>Row actions appear on hover, or when a row is focused.</span>
      </p>
    </div>
  );
}
