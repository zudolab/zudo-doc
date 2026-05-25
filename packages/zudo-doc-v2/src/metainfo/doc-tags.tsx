/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { VNode } from "preact";

/**
 * A single resolved tag with its navigation href. The legacy
 * `doc-tags.astro` called `resolvePageTags(tags)` and used `TagNav`
 * which computed `tagHref()` internally. v2 delegates both to the
 * caller so the component has no upward dependency on project routing
 * utilities.
 */
export interface ResolvedTag {
  /** Raw tag string (e.g. `"typescript"`). */
  tag: string;
  /** Pre-computed href for the tag page. */
  href: string;
}

/**
 * Controls vertical spacing: matches the `placement` prop on the
 * legacy `doc-tags.astro` component.
 *
 * - `"after-title"` — tight top margin, bottom margin to separate from
 *   the body (`mt-0 mb-vsp-md`).
 * - `"before-footer"` — extra top space, no bottom margin
 *   (`mt-vsp-xl mb-0`).
 */
export type TagPlacement = "after-title" | "before-footer";

export interface DocTagsProps {
  /**
   * Resolved tags with pre-computed hrefs. Pass an empty array (or
   * omit) to suppress rendering — mirrors the legacy
   * `resolvedTags.length > 0` guard.
   */
  tags?: ResolvedTag[];
  /**
   * Placement context — controls the outer container spacing class.
   */
  placement: TagPlacement;
  /**
   * Label shown before the tag list (e.g. `"Tags:"`). Pass the
   * i18n-resolved `t("doc.tags", locale)` string from upstream.
   * Defaults to `"Tags"`.
   */
  tagsLabel?: string;
  /**
   * Used in each tag's `aria-label` (`"Tagged with: <tag>"`). Defaults
   * to `"Tagged with"`.
   */
  taggedWithLabel?: string;
}

export const DEFAULT_TAGS_LABEL = "Tags";
export const DEFAULT_TAGGED_WITH_LABEL = "Tagged with";

/**
 * Page-level tag chips — JSX port of `src/components/doc-tags.astro`
 * (page-variant rendering from `src/components/tag-nav.astro`).
 *
 * Returns `null` when the `tags` array is empty, matching the original
 * `resolvedTags.length > 0` guard.
 *
 * The pointed-chip shape is reproduced verbatim from the page-variant
 * branch of `tag-nav.astro` using the same `clip-path` values.
 */
export function DocTags(props: DocTagsProps): VNode | null {
  const {
    tags = [],
    placement,
    tagsLabel = DEFAULT_TAGS_LABEL,
    taggedWithLabel = DEFAULT_TAGGED_WITH_LABEL,
  } = props;

  if (tags.length === 0) return null;

  const spacingClass =
    placement === "after-title" ? "mt-0 mb-vsp-md" : "mt-vsp-xl mb-0";

  return (
    <div class={spacingClass}>
      <div class="flex flex-wrap items-center gap-x-hsp-xs gap-y-vsp-xs">
        <span class="text-caption text-muted">{tagsLabel}:</span>
        {tags.map(({ tag, href }) => (
          <a
            key={tag}
            href={href}
            aria-label={`${taggedWithLabel}: ${tag}`}
            class="group relative inline-flex no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span
              class="absolute inset-0 bg-muted group-hover:bg-fg"
              style="clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)"
            />
            <span
              class="relative inline-flex items-center text-caption text-fg bg-bg pl-hsp-sm pr-hsp-lg py-vsp-2xs group-hover:text-bg group-hover:bg-fg"
              style="clip-path: polygon(1px 1px, calc(100% - 13px) 1px, calc(100% - 1px) 50%, calc(100% - 13px) calc(100% - 1px), 1px calc(100% - 1px))"
            >
              #{tag}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
