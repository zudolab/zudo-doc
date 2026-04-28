/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// JSX port of src/components/footer.astro.
//
// The original Astro template mixed data-prep (settings + getDocsCollection
// + tag-vocabulary lookups + locale overrides) with the presentational
// footer markup. Because v2 must stay decoupled from host-only helpers,
// only the presentational shell lives here: callers prepare the
// already-localized, already-resolved data upstream and feed it in via
// `linkColumns` / `tagColumns` / `copyright` props.
//
// Behaviour parity notes:
//
//  - When all three slots are empty/undefined the component returns null,
//    matching the Astro template's "early return when !footer" guard.
//
//  - When at least one slot has content, a `<footer>` shell is rendered.
//    The link/tag column grid is only emitted when at least one column is
//    present (mirrors the Astro `hasColumns &&` guard).
//
//  - The copyright block is rendered as-is via `dangerouslySetInnerHTML`
//    because the original template used `<Fragment set:html={copyright} />`
//    to allow inline anchors. Callers are responsible for sanitising
//    the string (the Astro version did the same — it trusted
//    `settings.footer.copyright`).
//
//  - When both columns and copyright exist, the copyright block is
//    visually separated by a top border + spacing, identical to the
//    `mt-vsp-lg border-t border-muted pt-vsp-md` that the Astro template
//    applied via `class:list` conditional.

import type { VNode } from "preact";

import type { FooterLinkColumn, FooterTagColumn } from "./types";

export interface FooterProps {
  /**
   * Already-localized link columns. Each item's href should be
   * base-prefixed and locale-aware; `isExternal` controls the
   * target/rel attributes.
   */
  linkColumns?: FooterLinkColumn[];
  /**
   * Already-resolved tag columns. Empty array (or omitted) hides the
   * taglist entirely. Each tag's href should already be base-prefixed.
   */
  tagColumns?: FooterTagColumn[];
  /**
   * Copyright HTML. Rendered via `dangerouslySetInnerHTML` so embedded
   * anchors work. The caller is responsible for the contents.
   */
  copyright?: string;
}

/**
 * Footer shell for the documentation layout.
 *
 * Returns null when every slot is empty so the host can place this
 * unconditionally inside the layout's `footer` slot without producing
 * an empty `<footer>` element.
 */
export function Footer(props: FooterProps): VNode | null {
  const linkColumns = props.linkColumns ?? [];
  const tagColumns = props.tagColumns ?? [];
  const copyright = props.copyright ?? "";

  const hasColumns = linkColumns.length > 0 || tagColumns.length > 0;
  const hasCopyright = copyright.length > 0;

  if (!hasColumns && !hasCopyright) return null;

  const copyrightClass = hasColumns
    ? "text-center text-caption text-muted [&_a]:text-accent [&_a]:underline mt-vsp-lg border-t border-muted pt-vsp-md"
    : "text-center text-caption text-muted [&_a]:text-accent [&_a]:underline";

  return (
    <footer class="border-t border-muted bg-surface">
      <div class="mx-auto max-w-[clamp(50rem,75vw,90rem)] px-hsp-xl py-vsp-xl lg:px-hsp-2xl lg:py-vsp-2xl">
        {hasColumns && (
          <div class="grid grid-cols-1 gap-vsp-lg sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
            {linkColumns.map((column, i) => (
              <div key={`link-${i}-${column.title}`}>
                <p class="text-small font-semibold text-fg mb-vsp-xs">
                  {column.title}
                </p>
                <ul class="list-none p-0">
                  {column.items.map((item, j) => (
                    <li
                      key={`item-${i}-${j}-${item.href}`}
                      class="mb-vsp-2xs"
                    >
                      <a
                        href={item.href}
                        class="text-caption text-muted hover:text-accent hover:underline focus-visible:underline"
                        {...(item.isExternal
                          ? {
                              target: "_blank",
                              rel: "noopener noreferrer",
                            }
                          : {})}
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {tagColumns.map((column, i) => (
              <div
                key={`tag-${i}-${column.group}`}
                data-taglist-group={column.group}
              >
                <h2 class="text-small font-semibold text-fg mb-vsp-xs">
                  {column.title}
                </h2>
                <ul class="list-none p-0">
                  {column.tags.map(({ tag, count, href }) => (
                    <li key={`tag-item-${tag}`} class="mb-vsp-2xs">
                      <a
                        href={href}
                        class="text-caption text-muted hover:text-accent hover:underline focus-visible:underline"
                      >
                        #{tag}
                        <span class="opacity-60" aria-hidden="true">
                          &nbsp;({count})
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {hasCopyright && (
          <div
            class={copyrightClass}
            dangerouslySetInnerHTML={{ __html: copyright }}
          />
        )}
      </div>
    </footer>
  );
}
