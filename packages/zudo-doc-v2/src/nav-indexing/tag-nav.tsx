/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// JSX port of src/components/tag-nav.astro.
//
// The original Astro template had two rendering branches controlled by the
// `variant` prop:
//
//   "all"  — collects all tags from the collection, sorts them, and renders
//            a full tag cloud (pointed-chip style) with counts.
//   "page" — renders a small inline chip row for the tags on the current page.
//
// Because v2 must not call getCollection() or import the host's collectTags /
// settings helpers, both variants now accept pre-resolved data as props.
// The host builds the tag list upstream and passes it in.
//
// Visual parity notes:
//   - The "all" variant uses 16px/12px clip-path widths for the arrow shape.
//   - The "page" variant uses 12px/8px clip-path widths (smaller chip).
//   - Both use the same two-layer border-faking technique from the original.
//   - Returns null when the relevant data is empty.

import type { JSX } from "preact";

import type { TagItem, TagLink, TagNavLabels } from "./types";

// ─── "all" variant ──────────────────────────────────────────────────────────

export interface TagNavAllProps {
  variant: "all";
  /** Pre-sorted tag list with counts and pre-resolved hrefs. */
  tags: TagItem[];
  /** i18n strings for aria-labels. */
  labels: TagNavLabels;
}

// ─── "page" variant ─────────────────────────────────────────────────────────

export interface TagNavPageProps {
  variant: "page";
  /** Tags for the current page with pre-resolved hrefs. */
  tagLinks: TagLink[];
  /** i18n strings for aria-labels. */
  labels: TagNavLabels;
}

export type TagNavProps = TagNavAllProps | TagNavPageProps;

// ─── Shared chip shapes ──────────────────────────────────────────────────────

/**
 * Large pointed chip — used in the "all" tag cloud.
 *
 * Outer: 16px arrow inset; inner: 17px (outer + 1px border rim).
 */
function AllTagChip({
  tag,
  count,
  href,
  labels,
}: TagItem & { labels: TagNavLabels }): JSX.Element {
  return (
    <li class="inline-flex whitespace-nowrap">
      <a
        href={href}
        aria-label={`${labels.taggedWith}: ${tag}`}
        class="group relative inline-flex no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span
          class="absolute inset-0 bg-muted group-hover:bg-fg"
          style="clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%)"
        />
        <span
          class="relative inline-flex items-center text-small text-fg bg-bg pl-hsp-sm pr-hsp-xl py-vsp-2xs group-hover:text-bg group-hover:bg-fg"
          style="clip-path: polygon(1px 1px, calc(100% - 17px) 1px, calc(100% - 1px) 50%, calc(100% - 17px) calc(100% - 1px), 1px calc(100% - 1px))"
        >
          <span>#{tag}</span>
          <span class="text-caption opacity-60">&nbsp;({count})</span>
        </span>
      </a>
    </li>
  );
}

/**
 * Small pointed chip — used in the per-page tag row.
 *
 * Outer: 12px arrow inset; inner: 13px (outer + 1px border rim).
 */
function PageTagChip({
  tag,
  href,
  labels,
}: TagLink & { labels: TagNavLabels }): JSX.Element {
  return (
    <a
      href={href}
      aria-label={`${labels.taggedWith}: ${tag}`}
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
  );
}

// ─── Public component ────────────────────────────────────────────────────────

/**
 * TagNav — JSX port of `src/components/tag-nav.astro`.
 *
 * Two variants:
 *
 *   - `variant="all"` — full tag cloud with count badges, sorted alphabetically
 *     by the caller. The host resolves `TagItem[]` (tag + count + href) before
 *     passing them in.
 *
 *   - `variant="page"` — small per-page chip strip. The host maps the
 *     frontmatter `tags: string[]` to `TagLink[]` (tag + href) before passing.
 *
 * Returns `null` when the relevant data is empty.
 */
export function TagNav(props: TagNavProps): JSX.Element | null {
  if (props.variant === "all") {
    const { tags, labels } = props;
    if (tags.length === 0) return null;

    return (
      <ul class="flex flex-wrap gap-x-hsp-xs gap-y-vsp-xs">
        {tags.map((item) => (
          <AllTagChip key={`tag-${item.tag}`} {...item} labels={labels} />
        ))}
      </ul>
    );
  }

  // variant === "page"
  const { tagLinks, labels } = props;
  if (tagLinks.length === 0) return null;

  return (
    <div class="flex flex-wrap items-center gap-x-hsp-xs gap-y-vsp-xs">
      <span class="text-caption text-muted">{labels.tags}:</span>
      {tagLinks.map((tl) => (
        <PageTagChip key={`ptag-${tl.tag}`} {...tl} labels={labels} />
      ))}
    </div>
  );
}
