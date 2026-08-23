/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";
import { rankWidth } from "../../note-tray-model/index.js";
import type { NoteTrayIndexProps } from "../note-tray-index.js";
import { DateLine } from "./date-line.js";

export function IndexList(props: NoteTrayIndexProps): JSX.Element {
  const width = rankWidth(props.items);
  return (
    <ol class="[&_li]:mb-0">
      {props.items.map((item) => {
        const rowClass = item.href
          ? "relative -mt-px first:mt-0 border-y border-muted hover:z-local-1 hover:border-accent focus-within:z-local-1 focus-within:border-accent"
          : "relative -mt-px first:mt-0 border-y border-muted";
        const rankClass = item.href
          ? "tabular-nums text-heading leading-none text-muted group-hover:text-fg group-focus-visible:text-fg"
          : "tabular-nums text-heading leading-none text-muted";
        const labelClass = item.href
          ? "font-medium text-fg underline decoration-muted group-hover:text-accent group-hover:decoration-accent group-focus-visible:text-accent group-focus-visible:decoration-accent"
          : "font-medium text-fg";
        const detailClass = item.href
          ? "mt-vsp-2xs block text-small text-muted group-hover:text-accent group-hover:underline group-focus-visible:text-accent group-focus-visible:underline"
          : "mt-vsp-2xs block text-small text-muted";
        const dateClass = item.href
          ? "mt-vsp-2xs block text-caption text-muted group-hover:text-accent group-hover:underline group-focus-visible:text-accent group-focus-visible:underline"
          : "mt-vsp-2xs block text-caption text-muted";
        const rowContent = (
          <>
            <span class={rankClass} style={{ width: `${width}ch` }}>
              {item.rank === undefined ? "" : String(item.rank).padStart(width, "0")}
            </span>
            <span class="min-w-0">
              <span class={labelClass}>{item.label}</span>
              {item.description && <span class={detailClass}>{item.description}</span>}
              {props.showDate && (
                <span class={dateClass}>
                  <DateLine item={item} locale={props.locale} updatedLabel={props.updatedLabel} />
                </span>
              )}
            </span>
          </>
        );

        return (
          <li key={item.slug} class={rowClass}>
            {item.href ? (
              <a href={item.href} class="group grid grid-cols-[auto_1fr] gap-x-hsp-lg py-vsp-md">
                {rowContent}
              </a>
            ) : (
              <span class="grid grid-cols-[auto_1fr] gap-x-hsp-lg py-vsp-md">{rowContent}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
