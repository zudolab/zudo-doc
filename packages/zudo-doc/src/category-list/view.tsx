/** @jsxRuntime automatic */
// category-list/view — presentation for the category-driven listing
// (zudolab/zudo-doc#4802): accepted layout B (`cards`) and C (`list`, the
// two-column navigation index). Both layouts render the SAME resolved items
// and the SAME metadata contract; only the arrangement differs.
//
// Server-only markup: whole items are ordinary links, tags are plain text so
// there are never nested anchors, and the responsive columns come from
// container queries in `features.css` (`.zd-category-list`), so a narrow
// placement collapses even inside a wide viewport.

import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { formatDate, formatMonthDayLabel, formatYear } from "../format-date/index.js";
import type { ResolvedDateFormats } from "../settings.js";
import { CategoryLinkIcon } from "../tree-nav-shared/index.js";
import {
  resolveCategoryListLead,
  type CategoryListItem,
  type CategoryListLayout,
  type CategoryListLead,
  type CategoryListResolved,
} from "./model.js";

/** Localized strings the view needs. */
export interface CategoryListLabels {
  /** Archive link text, e.g. "See all". */
  archive: string;
  /** Footer count template with `{shown}` and `{total}`, e.g. "Showing {shown} of {total}". */
  count: string;
  /** Prefix for the updated date, e.g. "Updated". */
  updated: string;
  /** Screen-reader label for the tag list, e.g. "Tags". */
  tags: string;
  /** Screen-reader label for the subcategory path, e.g. "In". */
  path: string;
}

/** Metadata toggles after defaults are applied. */
export interface CategoryListDisplay {
  layout: CategoryListLayout;
  lead: CategoryListLead;
  showDescription: boolean;
  showDate: boolean;
  showUpdated: boolean;
  showTags: boolean;
  showPath: boolean;
  showCount: boolean;
  showArchive: boolean;
}

export interface CategoryListViewProps {
  resolved: CategoryListResolved;
  display: CategoryListDisplay;
  labels: CategoryListLabels;
  locale: string;
  dateFormats?: ResolvedDateFormats;
  /** Heading level of item titles. @default 3 (beneath a section H2) */
  titleLevel?: 3 | 4;
}

/** Defaults for omitted toggles — kept in one place for the docs and tests. */
export function resolveCategoryListDisplay(options: {
  layout?: CategoryListLayout;
  lead?: CategoryListLead;
  showDescription?: boolean;
  showDate?: boolean;
  showUpdated?: boolean;
  showTags?: boolean;
  showPath?: boolean;
  showCount?: boolean;
  showArchive?: boolean;
}): CategoryListDisplay {
  return {
    layout: options.layout ?? "cards",
    lead: options.lead ?? "auto",
    showDescription: options.showDescription ?? true,
    showDate: options.showDate ?? false,
    showUpdated: options.showUpdated ?? false,
    showTags: options.showTags ?? false,
    showPath: options.showPath ?? false,
    showCount: options.showCount ?? false,
    showArchive: options.showArchive ?? true,
  };
}

function fillCount(template: string, shown: number, total: number): string {
  return template.replace(/\{shown\}/g, String(shown)).replace(/\{total\}/g, String(total));
}

const LINKED_MUTED = "text-muted group-hover:text-accent group-focus-visible:text-accent";

function Lead({
  item,
  kind,
  layout,
  width,
  locale,
  dateFormats,
}: {
  item: CategoryListItem;
  kind: "rank" | "date";
  layout: CategoryListLayout;
  width: number;
  locale: string;
  dateFormats?: ResolvedDateFormats;
}): JSX.Element | null {
  if (kind === "rank") {
    if (item.rank === undefined) return <span class="zd-category-list-lead" />;
    return (
      <span class={`zd-category-list-lead zd-category-list-rank tabular-nums ${LINKED_MUTED}`}>
        {String(item.rank).padStart(width, "0")}
      </span>
    );
  }
  if (!item.date) return <span class="zd-category-list-lead" />;
  if (layout === "list") {
    return (
      <time datetime={item.date} class={`zd-category-list-lead tabular-nums ${LINKED_MUTED}`}>
        <span class="block text-small font-medium leading-tight">
          {formatMonthDayLabel(item.date, locale, dateFormats?.monthDay)}
        </span>{" "}
        <span class="block text-micro">{formatYear(item.date, locale, dateFormats?.year)}</span>
      </time>
    );
  }
  return (
    <time datetime={item.date} class={`zd-category-list-lead tabular-nums text-caption ${LINKED_MUTED}`}>
      {formatDate(item.date, locale, dateFormats?.full)}
    </time>
  );
}

function Meta({
  item,
  display,
  leadKind,
  labels,
  locale,
  dateFormats,
}: {
  item: CategoryListItem;
  display: CategoryListDisplay;
  leadKind: "none" | "rank" | "date";
  labels: CategoryListLabels;
  locale: string;
  dateFormats?: ResolvedDateFormats;
}): JSX.Element | null {
  const parts: JSX.Element[] = [];
  if (display.showDate && item.date && leadKind !== "date") {
    parts.push(
      <time key="date" datetime={item.date} class="tabular-nums">
        {formatDate(item.date, locale, dateFormats?.full)}
      </time>,
    );
  }
  if (display.showUpdated && item.updated && item.updated !== item.date) {
    parts.push(
      <span key="updated" class="tabular-nums">
        {labels.updated}{" "}
        <time datetime={item.updated}>{formatDate(item.updated, locale, dateFormats?.full)}</time>
      </span>,
    );
  }
  if (display.showPath && item.path.length > 0) {
    parts.push(
      <span key="path">
        <span class="sr-only">{labels.path} </span>
        {item.path.join(" / ")}
      </span>,
    );
  }
  if (display.showTags && item.tags.length > 0) {
    parts.push(
      <span key="tags" class="zd-category-list-tags">
        <span class="sr-only">{labels.tags}: </span>
        {item.tags.map((tag) => (
          <span key={tag} class="zd-category-list-tag rounded border border-muted px-hsp-2xs">
            {tag}
          </span>
        ))}
      </span>,
    );
  }
  if (parts.length === 0) return null;
  return <span class={`zd-category-list-meta text-caption ${LINKED_MUTED}`}>{parts}</span>;
}

function Title({ level, children }: { level: 3 | 4; children: string }): JSX.Element {
  const className =
    "zd-category-list-title font-medium leading-snug text-fg group-hover:text-accent group-hover:underline group-focus-visible:text-accent group-focus-visible:underline";
  return level === 4 ? <h4 class={className}>{children}</h4> : <h3 class={className}>{children}</h3>;
}

/**
 * Render a resolved category listing as `cards` (B) or `list` (C) with an
 * optional footer (count + archive link). Renders nothing for an empty list —
 * the caller owns any surrounding heading and must suppress it as well.
 */
export function CategoryListView({
  resolved,
  display,
  labels,
  locale,
  dateFormats,
  titleLevel = 3,
}: CategoryListViewProps): JSX.Element | null {
  const { items, total, category } = resolved;
  if (items.length === 0) return null;

  const leadKind = resolveCategoryListLead(display.lead, category);
  const width = resolved.rankWidth ?? 2;
  const hasLead =
    leadKind === "rank"
      ? items.some((item) => item.rank !== undefined)
      : leadKind === "date"
        ? items.some((item) => item.date !== undefined)
        : false;
  const effectiveLead = hasLead ? leadKind : "none";
  const archiveHref = display.showArchive ? category.href : undefined;
  const showFooter = display.showCount || archiveHref !== undefined;

  return (
    <div
      class="zd-category-list"
      data-zd-category-list={category.slug}
      data-layout={display.layout}
      data-lead={effectiveLead}
      {...(display.showDescription ? { "data-descriptions": "" } : {})}
    >
      <ul class="zd-category-list-items" role="list">
        {items.map((item) => (
          <li key={item.slug} class="zd-category-list-item">
            <a
              href={item.href}
              class="zd-category-list-link group text-fg"
              style={effectiveLead === "rank" ? { "--zd-category-list-rank-width": `${width}ch` } : undefined}
            >
              {effectiveLead !== "none" && (
                <Lead
                  item={item}
                  kind={effectiveLead}
                  layout={display.layout}
                  width={width}
                  locale={locale}
                  dateFormats={dateFormats}
                />
              )}
              <div class="zd-category-list-body">
                <Title level={titleLevel}>{item.title}</Title>
                {display.showDescription && item.description && (
                  <span class={`zd-category-list-description block text-small ${LINKED_MUTED}`}>
                    {item.description}
                  </span>
                )}
                {display.layout === "list" && (
                  <Meta
                    item={item}
                    display={display}
                    leadKind={effectiveLead}
                    labels={labels}
                    locale={locale}
                    dateFormats={dateFormats}
                  />
                )}
              </div>
              {display.layout === "cards" && (
                <Meta
                  item={item}
                  display={display}
                  leadKind={effectiveLead}
                  labels={labels}
                  locale={locale}
                  dateFormats={dateFormats}
                />
              )}
              <CategoryLinkIcon class={`zd-category-list-chevron w-icon-sm ${LINKED_MUTED}`} />
            </a>
          </li>
        ))}
      </ul>
      {showFooter && (
        <div class="zd-category-list-footer text-small">
          {display.showCount && (
            <p class="zd-category-list-count text-caption text-muted tabular-nums">
              {fillCount(labels.count, items.length, total)}
            </p>
          )}
          {archiveHref !== undefined && (
            <a
              href={archiveHref}
              class="zd-category-list-archive group inline-flex items-center gap-hsp-xs text-fg hover:text-accent hover:underline focus-visible:text-accent focus-visible:underline"
            >
              <span>{labels.archive}</span>
              <CategoryLinkIcon class="w-icon-sm text-muted group-hover:text-accent group-focus-visible:text-accent" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
