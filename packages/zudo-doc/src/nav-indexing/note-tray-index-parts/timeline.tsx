/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";
import {
  formatDate,
  formatYearMonthLabel,
  groupItems,
  parseIsoDate,
} from "../../note-tray-model/index.js";
import type { NoteTrayIndexProps } from "../note-tray-index.js";
import { ItemTags } from "./date-line.js";

export function Timeline(props: NoteTrayIndexProps): JSX.Element {
  const groups = groupItems(props.items, "month", props.order ?? "asc");
  return (
    <div class="space-y-vsp-lg">
      {groups.map((group) => (
        <section key={group.key}>
          <h2 class="mb-vsp-sm text-small font-medium text-fg">
            {formatYearMonthLabel(group.key, props.locale)}
          </h2>
          <ol class="ml-hsp-md border-l border-muted [&_li]:mb-0">
            {group.items.map((item) => (
              <li key={item.slug} class="relative grid gap-vsp-2xs pl-hsp-xl pb-vsp-lg last:pb-0">
                {item.href ? (
                  <a
                    class="peer font-medium text-fg underline decoration-muted hover:text-accent hover:decoration-accent focus-visible:text-accent focus-visible:decoration-accent"
                    href={item.href}
                  >
                    {item.label}
                  </a>
                ) : (
                  <span class="peer font-medium text-fg">{item.label}</span>
                )}
                <time
                  datetime={item.date}
                  class="absolute top-hsp-2xs -left-[calc(var(--spacing-icon-lg)/2)] grid size-icon-lg place-items-center rounded-full border border-muted bg-bg text-caption leading-none tabular-nums text-muted peer-hover:border-accent peer-hover:text-accent peer-focus-visible:border-accent peer-focus-visible:text-accent"
                >
                  <span aria-hidden="true">{item.date ? (parseIsoDate(item.date)?.day ?? "") : ""}</span>
                  <span class="sr-only">{item.date ? formatDate(item.date, props.locale) : ""}</span>
                </time>
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
