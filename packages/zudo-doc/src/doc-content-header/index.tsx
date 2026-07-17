/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// doc-content-header — factory for the shared content header block
// (epic #2344, S7).
//
// The host's `pages/lib/_doc-content-header.tsx` previously imported host
// singletons (`@/config/i18n`, `@/config/frontmatter-preview-renderers`),
// and called host-bound helpers (`buildFrontmatterPreviewEntries`). This
// factory receives those as injected dependencies so the logic lives in the
// package while the host stub keeps the singleton imports.

import type { ComponentChildren, JSX } from "preact";
import { FrontmatterPreview, type FrontmatterCellRenderer } from "../metainfo/index.js";
import type { DocPageEntry } from "../doc-page-props/index.js";
import type { ChromeContext } from "../factory-context/index.js";
import type { Settings } from "../settings.js";
import { createDocMetainfoArea } from "../doc-metainfo-area/index.js";
import { createDocTagsArea } from "../doc-tags-area/index.js";
import { assertChromeContext } from "../chrome/assert-chrome-context.js";

export type { FrontmatterCellRenderer };

/** Dependencies injected by the host stub. */
export interface DocContentHeaderDeps {
  /** Translate a UI string key for a locale. */
  t: (key: string, locale: string) => string;
  /**
   * Filter a doc entry's `data` (frontmatter) into the `entries` array expected
   * by `<FrontmatterPreview>`. Host passes the result of
   * `createBuildFrontmatterPreviewEntries` bound to `settings` + defaultIgnoreKeys.
   */
  buildFrontmatterPreviewEntries: (
    data: Record<string, unknown> | null | undefined,
  ) => Array<[string, unknown]>;
  /**
   * Custom per-key renderers for frontmatter cells (from
   * `@/config/frontmatter-preview-renderers`). Host-side — these produce
   * styled cells (pills, badges, etc.) using host components/theme.
   */
  frontmatterRenderers: Record<string, FrontmatterCellRenderer>;
  /**
   * The `DocMetainfoArea` component (host-side factory result — reads
   * settings.docMetainfo and the manifest).
   */
  DocMetainfoArea: (props: {
    slug: string;
    locale: string;
    isFallback?: boolean;
  }) => JSX.Element | null;
  /**
   * The `DocTagsArea` component (host-side factory result — reads settings.docTags).
   */
  DocTagsArea: (props: {
    slug: string;
    locale: string;
    tags: readonly string[] | undefined;
  }) => JSX.Element | null;
}

interface DocContentHeaderProps {
  /** The full content entry (title, description, tags, frontmatter data). */
  entry: DocPageEntry;
  /** Canonical page slug for DocMetainfoArea / DocTagsArea lookups. */
  slug: string;
  /** Active locale string, e.g. "en", "ja". */
  locale: string;
  /**
   * True when this page falls back to the base EN collection for a locale
   * route. Renders the "not yet translated" notice. Defaults to false.
   * Only relevant for locale-prefixed and versioned-locale routes.
   */
  isFallback?: boolean;
  /**
   * Version slug when rendering a versioned route (e.g. "1.0"); undefined =
   * latest. On versioned pages the date block and tag chips are hidden —
   * the doc-history-meta manifest is built only from the LATEST content
   * dirs, so a bare versioned slug would resolve to the latest file's
   * Created/Updated/Author (wrong data), and tag chips would link to latest
   * tag routes that may not exist for version-only tags (404). Mirrors the
   * #1916 reduced-chrome stance that already hides doc history on
   * versioned pages.
   */
  version?: string;
}

/**
 * Create a `DocContentHeader` component from the unified {@link ChromeContext}
 * (epic Collapse Wiring Shells #2420, FACTORIES #2424 — breaking signature).
 *
 * Reads `t` directly; the frontmatter-preview entry builder + per-key renderers
 * are HOST-bound slots (`ctx.hostBindings.buildFrontmatterPreviewEntries` /
 * `…frontmatterRenderers`, defaulting to `() => []` / `{}`). The nested
 * `DocMetainfoArea` / `DocTagsArea` are rebuilt from the same context.
 *
 * `ctx.hostBindings.docContentHeaderExtras` (default: absent) renders after
 * the `<h1>` and before `DocMetainfoArea` — see the `ChromeHostBindings`
 * interface in `./factory-context`.
 */
export function createDocContentHeader<S extends Settings = Settings>(
  ctx: ChromeContext<S>,
): (props: DocContentHeaderProps) => JSX.Element {
  assertChromeContext(ctx, "createDocContentHeader");
  const t = ctx.t;
  const buildFrontmatterPreviewEntries = (ctx.hostBindings.buildFrontmatterPreviewEntries ??
    (() => [])) as DocContentHeaderDeps["buildFrontmatterPreviewEntries"];
  const frontmatterRenderers = (ctx.hostBindings.frontmatterRenderers ??
    {}) as unknown as Record<string, FrontmatterCellRenderer>;
  const docContentHeaderExtras = ctx.hostBindings.docContentHeaderExtras;
  const DocMetainfoArea = createDocMetainfoArea(ctx);
  const DocTagsArea = createDocTagsArea(ctx);

  /**
   * Content header block for entry doc pages: h1, doc-metainfo, tag chips,
   * optional locale-fallback notice, description paragraph, and frontmatter
   * preview table.
   *
   * Placement: at the top of the article `<Fragment>`, before
   * `<props.entry.Content />` and the pager. The MDX content and DocHistoryArea
   * remain in the route component so per-route variations (unlisted gate,
   * contentDir) stay co-located with their context.
   */
  function DocContentHeader({
    entry,
    slug,
    locale,
    isFallback = false,
    version,
  }: DocContentHeaderProps): JSX.Element {
    return (
      <>
        <h1 class="text-heading font-bold mb-vsp-xs">{entry.data.title}</h1>

        {/* Host-bound extras slot (ctx.hostBindings.docContentHeaderExtras).
            Default absent → renders nothing. Fires on versioned pages too —
            the renderer receives `version` and decides for itself, unlike
            DocMetainfoArea/DocTagsArea below which are unconditionally
            hidden on versioned pages. */}
        {docContentHeaderExtras?.({
          entry,
          slug,
          locale,
          isFallback,
          version,
        }) as ComponentChildren}

        {/* Build-time date block (Created / Updated / Author).
            doc-metainfo placement — between <h1> and description.
            Data from `.zfb/doc-history-meta.json` (esbuild-inlined, no fs).
            Hidden on versioned pages — the manifest only covers latest
            content dirs, so a versioned slug would show the LATEST file's
            dates (see the `version` prop doc above). */}
        {!version && (
          <DocMetainfoArea slug={slug} locale={locale} isFallback={isFallback} />
        )}

        {/* Page-level tag chips — matching doc-tags placement (#1658).
            Hidden on versioned pages: tag routes are built from latest
            frontmatter only, so a version-only tag chip would 404 (see the
            `version` prop doc above). */}
        {!version && <DocTagsArea slug={slug} locale={locale} tags={entry.data.tags} />}

        {/* Fallback notice for non-translated pages */}
        {isFallback && !(entry.data as Record<string, unknown>).generated && (
          <div
            class="mb-vsp-md border border-info/30 bg-info/5 px-hsp-lg py-vsp-sm text-small text-muted rounded"
            role="note"
          >
            {t("doc.fallbackNotice", locale)}
          </div>
        )}

        {entry.data.description && (
          <p class="mb-vsp-lg text-title text-muted" data-doc-description>
            {entry.data.description}
          </p>
        )}

        {/* Frontmatter preview — non-system, custom keys only. Returns
            null when the entries array is empty, so pages without
            custom frontmatter emit nothing. Custom per-key renderers
            from frontmatter-preview-renderers.tsx produce styled cells
            (pills, badges, etc.) instead of plain text. */}
        <FrontmatterPreview
          entries={buildFrontmatterPreviewEntries(entry.data as Record<string, unknown>)}
          title={t("frontmatter.preview.title", locale)}
          keyColLabel={t("frontmatter.preview.keyCol", locale)}
          valueColLabel={t("frontmatter.preview.valueCol", locale)}
          renderers={frontmatterRenderers}
          data={entry.data as Record<string, unknown>}
          locale={locale}
        />
      </>
    );
  }

  return DocContentHeader;
}
