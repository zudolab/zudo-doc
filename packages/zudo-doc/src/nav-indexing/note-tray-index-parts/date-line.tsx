/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";
import { formatDate } from "../../note-tray-model/index.js";
import type { NoteTrayIndexItem } from "../note-tray-index.js";
import { TagNav } from "../tag-nav.js";
import type { TagNavLabels } from "../types.js";

export function DateLine({
  item,
  locale,
  updatedLabel,
}: {
  item: NoteTrayIndexItem;
  locale: string;
  updatedLabel: string;
}): JSX.Element | null {
  if (!item.date && !item.updated) return null;
  return (
    <span class="tabular-nums text-caption text-muted">
      {item.date && <time datetime={item.date}>{formatDate(item.date, locale)}</time>}
      {item.date && item.updated && <span aria-hidden="true"> · </span>}
      {item.updated && (
        <span>
          {updatedLabel} <time datetime={item.updated}>{formatDate(item.updated, locale)}</time>
        </span>
      )}
    </span>
  );
}

export function ItemTags({ item, labels }: { item: NoteTrayIndexItem; labels?: TagNavLabels }) {
  if (!labels || !item.tagLinks?.length) return null;
  return <TagNav variant="page" tagLinks={item.tagLinks} labels={labels} />;
}
