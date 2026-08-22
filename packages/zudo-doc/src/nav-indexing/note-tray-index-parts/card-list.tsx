/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";
import type { NoteTrayIndexProps } from "../note-tray-index.js";
import { DateLine, ItemTags } from "./date-line.js";

export function CardList(props: NoteTrayIndexProps): JSX.Element {
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
