/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";
import { formatYearMonthLabel, groupItems } from "../../note-tray-model/index.js";
import type { NoteTrayIndexProps } from "../note-tray-index.js";
import { DateLine, ItemTags } from "./date-line.js";

export function Timeline(props: NoteTrayIndexProps): JSX.Element {
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
