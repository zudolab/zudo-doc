/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";
import {
  formatDate,
  formatYearMonthLabel,
  groupItems,
  rankWidth,
  type NoteTrayOrder,
} from "../note-tray-model/index.js";
import { TagNav } from "./tag-nav.js";
import type { TagLink, TagNavLabels } from "./types.js";

export type NoteTrayIndexStyle = "index" | "cards" | "timeline";

export interface NoteTrayIndexItem {
  slug: string;
  label: string;
  description?: string;
  href?: string;
  hasPage?: boolean;
  children: NoteTrayIndexItem[];
  rank?: number;
  date?: string;
  updated?: string;
  tagLinks?: TagLink[];
}

export interface NoteTrayIndexProps {
  items: NoteTrayIndexItem[];
  style?: NoteTrayIndexStyle;
  showDate?: boolean;
  locale: string;
  updatedLabel: string;
  dated: boolean;
  order?: NoteTrayOrder;
  tagLabels?: TagNavLabels;
}

function DateLine({
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

function ItemTags({ item, labels }: { item: NoteTrayIndexItem; labels?: TagNavLabels }) {
  if (!labels || !item.tagLinks?.length) return null;
  return <TagNav variant="page" tagLinks={item.tagLinks} labels={labels} />;
}

function IndexList(props: NoteTrayIndexProps): JSX.Element {
  const width = rankWidth(props.items);
  return (
    <ol class="border-t border-muted">
      {props.items.map((item) => (
        <li
          key={item.slug}
          class="grid grid-cols-[auto_1fr] gap-x-hsp-lg border-b border-muted py-vsp-md"
        >
          <span
            class="tabular-nums text-heading leading-none text-muted"
            style={{ width: `${width}ch` }}
          >
            {item.rank === undefined ? "" : String(item.rank).padStart(width, "0")}
          </span>
          <div class="min-w-0">
            {item.href ? (
              <a
                class="font-medium text-fg hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                href={item.href}
              >
                {item.label}
              </a>
            ) : (
              <span class="font-medium text-fg">{item.label}</span>
            )}
            {item.description && <p class="mt-vsp-2xs text-small text-muted">{item.description}</p>}
            {props.showDate && (
              <span class="mt-vsp-2xs block">
                <DateLine item={item} locale={props.locale} updatedLabel={props.updatedLabel} />
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function CardList(props: NoteTrayIndexProps): JSX.Element {
  return (
    <div class="grid grid-cols-1 gap-vsp-md">
      {props.items.map((item) => (
        <article key={item.slug} class="rounded border border-muted bg-surface px-hsp-xl py-vsp-lg">
          {props.showDate && (
            <div class="mb-vsp-xs">
              <DateLine item={item} locale={props.locale} updatedLabel={props.updatedLabel} />
            </div>
          )}
          <h2 class="text-title font-medium">
            {item.href ? (
              <a
                class="text-fg hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                href={item.href}
              >
                {item.label}
              </a>
            ) : (
              item.label
            )}
          </h2>
          {item.description && <p class="mt-vsp-xs text-muted">{item.description}</p>}
          {item.tagLinks?.length ? (
            <div class="mt-vsp-md">
              <ItemTags item={item} labels={props.tagLabels} />
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function Timeline(props: NoteTrayIndexProps): JSX.Element {
  const groups = groupItems(props.items, "month", props.order ?? "asc");
  return (
    <div class="space-y-vsp-lg">
      {groups.map((group) => (
        <section key={group.key}>
          <h2 class="mb-vsp-sm text-small font-medium text-fg">
            {formatYearMonthLabel(group.key, props.locale)}
          </h2>
          <ol class="ml-hsp-xs border-l border-muted">
            {group.items.map((item) => (
              <li key={item.slug} class="relative grid gap-vsp-2xs pb-vsp-lg pl-hsp-lg last:pb-0">
                <span
                  class="absolute -left-hsp-xs top-vsp-2xs size-icon-xs rounded-full border border-bg bg-muted"
                  aria-hidden="true"
                />
                <div class="flex flex-wrap items-baseline gap-x-hsp-sm gap-y-vsp-2xs">
                  <DateLine item={item} locale={props.locale} updatedLabel={props.updatedLabel} />
                  {item.href ? (
                    <a
                      class="font-medium text-fg hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      href={item.href}
                    >
                      {item.label}
                    </a>
                  ) : (
                    <span class="font-medium text-fg">{item.label}</span>
                  )}
                </div>
                {item.description && <p class="text-small text-muted">{item.description}</p>}
                <ItemTags item={item} labels={props.tagLabels} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

export function NoteTrayIndex(props: NoteTrayIndexProps): JSX.Element | null {
  if (props.items.length === 0) return null;
  if (props.style === "timeline" && !props.dated) {
    throw new Error('[zudo-doc] <NoteTrayIndex style="timeline"> requires a dated note tray.');
  }
  switch (props.style ?? "index") {
    case "cards":
      return <CardList {...props} />;
    case "timeline":
      return <Timeline {...props} />;
    default:
      return <IndexList {...props} />;
  }
}
