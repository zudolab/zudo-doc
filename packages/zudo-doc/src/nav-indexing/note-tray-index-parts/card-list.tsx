/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";
import { formatMonthDayLabel, formatYear } from "../../format-date/index.js";
import { CategoryLinkIcon } from "../../tree-nav-shared/index.js";
import type { NoteTrayIndexProps } from "../note-tray-index.js";
import { TagNav } from "../tag-nav.js";
import { DateLine } from "./date-line.js";

function CardBody({
  item,
  props,
  linked,
  hasStamp,
}: {
  item: NoteTrayIndexProps["items"][number];
  props: NoteTrayIndexProps;
  linked: boolean;
  hasStamp: boolean;
}): JSX.Element {
  const titleClass = linked
    ? "flex items-start gap-hsp-xs text-accent underline group-hover:text-accent-hover group-focus-visible:text-accent-hover"
    : "flex items-start gap-hsp-xs text-accent underline";
  const descriptionClass = linked
    ? "mt-vsp-xs text-small text-muted group-hover:text-accent group-hover:underline group-focus-visible:text-accent group-focus-visible:underline"
    : "mt-vsp-xs text-small text-muted";

  return (
    <div class="min-w-0">
      <div class="flex flex-wrap items-baseline gap-x-hsp-md gap-y-vsp-3xs">
        <h2 class="text-title font-medium leading-tight">
          <span class={titleClass}>
            <span class="flex h-[1lh] items-center">
              <CategoryLinkIcon className="w-icon-sm" />
            </span>
            {item.label}
          </span>
        </h2>
        {props.showDate && (
          <span class={hasStamp ? "sm:hidden" : undefined}>
            <DateLine item={item} locale={props.locale} updatedLabel={props.updatedLabel} />
          </span>
        )}
      </div>
      {item.description && <p class={descriptionClass}>{item.description}</p>}
    </div>
  );
}

function DateStamp({
  date,
  updated,
  locale,
  updatedLabel,
  positioned,
}: {
  date: string;
  updated?: string;
  locale: string;
  updatedLabel: string;
  positioned: boolean;
}): JSX.Element {
  return (
    <time
      datetime={date}
      class={
        positioned
          ? "hidden sm:flex sm:col-start-2 sm:row-start-1 sm:row-span-2 w-[6.5rem] flex-col items-end self-stretch border-l border-muted pl-hsp-xl text-muted tabular-nums"
          : "hidden sm:flex w-[6.5rem] flex-col items-end self-stretch border-l border-muted pl-hsp-xl text-muted tabular-nums"
      }
    >
      <span class="block text-title leading-tight font-medium">
        {formatMonthDayLabel(date, locale)}
      </span>
      <span class="block text-caption">{formatYear(date, locale)}</span>
      {updated && (
        <span class="mt-vsp-3xs block text-micro">
          {updatedLabel} {formatMonthDayLabel(updated, locale)}
        </span>
      )}
    </time>
  );
}

export function CardList(props: NoteTrayIndexProps): JSX.Element {
  return (
    <div class="grid grid-cols-1 gap-vsp-md">
      {props.items.map((item) => (
        <article
          key={item.slug}
          class={
            props.tagLabels && item.tagLinks?.length
              ? "grid grid-rows-[auto_auto] gap-y-vsp-md sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-hsp-xl"
              : undefined
          }
        >
          {props.tagLabels && item.tagLinks?.length ? (
            <>
              {item.href ? (
                <a
                  href={item.href}
                  class="group col-span-full row-span-2 grid grid-rows-subgrid sm:grid-cols-subgrid rounded border border-muted bg-surface px-hsp-xl py-vsp-lg hover:border-accent focus-visible:border-accent"
                >
                  <div class="col-start-1 row-start-1 min-w-0">
                    <CardBody
                      item={item}
                      props={props}
                      linked
                      hasStamp={Boolean(props.showDate && item.date)}
                    />
                  </div>
                  {props.showDate && item.date && (
                    <DateStamp
                      date={item.date}
                      updated={item.updated}
                      locale={props.locale}
                      updatedLabel={props.updatedLabel}
                      positioned
                    />
                  )}
                </a>
              ) : (
                <div class="col-span-full row-span-2 grid grid-rows-subgrid sm:grid-cols-subgrid rounded border border-muted bg-surface px-hsp-xl py-vsp-lg">
                  <div class="col-start-1 row-start-1 min-w-0">
                    <CardBody
                      item={item}
                      props={props}
                      linked={false}
                      hasStamp={Boolean(props.showDate && item.date)}
                    />
                  </div>
                  {props.showDate && item.date && (
                    <DateStamp
                      date={item.date}
                      updated={item.updated}
                      locale={props.locale}
                      updatedLabel={props.updatedLabel}
                      positioned
                    />
                  )}
                </div>
              )}
              <div class="col-start-1 row-start-2 relative pointer-events-none [&_a]:pointer-events-auto ml-[calc(var(--spacing-hsp-xl)+1px)] mr-[calc(var(--spacing-hsp-xl)+1px)] sm:mr-0 mb-vsp-lg">
                <TagNav variant="page" tagLinks={item.tagLinks} labels={props.tagLabels} />
              </div>
            </>
          ) : item.href ? (
            <a
              href={item.href}
              class="group block rounded border border-muted bg-surface px-hsp-xl py-vsp-lg hover:border-accent focus-visible:border-accent sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-hsp-xl"
            >
              <CardBody
                item={item}
                props={props}
                linked
                hasStamp={Boolean(props.showDate && item.date)}
              />
              {props.showDate && item.date && (
                <DateStamp
                  date={item.date}
                  updated={item.updated}
                  locale={props.locale}
                  updatedLabel={props.updatedLabel}
                  positioned={false}
                />
              )}
            </a>
          ) : (
            <div class="block rounded border border-muted bg-surface px-hsp-xl py-vsp-lg sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-hsp-xl">
              <CardBody
                item={item}
                props={props}
                linked={false}
                hasStamp={Boolean(props.showDate && item.date)}
              />
              {props.showDate && item.date && (
                <DateStamp
                  date={item.date}
                  updated={item.updated}
                  locale={props.locale}
                  updatedLabel={props.updatedLabel}
                  positioned={false}
                />
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
