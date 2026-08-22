/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";
import { rankWidth } from "../../note-tray-model/index.js";
import type { NoteTrayIndexProps } from "../note-tray-index.js";
import { DateLine } from "./date-line.js";

export function IndexList(props: NoteTrayIndexProps): JSX.Element {
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
