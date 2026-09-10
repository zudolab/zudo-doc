/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// doc-metainfo-area — factory for the locale-aware DocMetainfo area wrapper
// (epic #2344, S7).
//
// The host's `pages/lib/_doc-metainfo-area.tsx` previously read
// `settings.docMetainfo` and `defaultLocale` at module scope. This factory
// receives those as arguments so the logic lives in the package while the host
// stub keeps the singleton imports.
//
// The `docHistoryMeta` JSON import stays in the host stub — it depends on the
// `#doc-history-meta` path alias which the zfb bundler resolves for the host
// project only (it's a shadow-tree tsconfig alias — not portable to the package).
// The factory receives the parsed manifest as a plain JS object.

import type { VNode } from "preact";
import { DocMetainfo } from "../metainfo/index.js";
import type { ChromeContext } from "../factory-context/index.js";
import type { Settings } from "../settings.js";
import { toHistorySlug } from "../slug/index.js";
import { assertChromeContext } from "../chrome/assert-chrome-context.js";
import { deriveDateFormats } from "../chrome/derive.js";
import { formatDate } from "../format-date/index.js";

/** Per-entry metadata shape from the doc-history manifest. */
export interface DocHistoryMetaEntry {
  author: string;
  createdDate: string;
  updatedDate: string;
  ext: ".mdx" | ".md";
}

/** Settings subset read by the DocMetainfoArea factory. */
export interface DocMetainfoAreaSettings {
  docMetainfo: boolean;
  /** Metadata fields shown in the doc metadata area; omitted means all fields. */
  docMetainfoFields?: Array<"created" | "updated" | "author">;
}

export interface DocMetainfoAreaProps {
  /** Page slug, e.g. "getting-started/intro". */
  slug: string;
  /** Active locale string, e.g. "en", "ja". */
  locale: string;
  /**
   * True when this locale page falls back to the base EN collection
   * (i.e. the slug has no translation for the active locale). When true,
   * the manifest lookup uses defaultLocale so the visible block resolves
   * the bare-slug key — the only key that exists for EN-origin files —
   * matching the dropdown's `effectiveHistoryLocale` derivation in
   * _doc-history-area.tsx. Display formatting (dates + labels) still uses
   * the active locale so JA users see JA formatting on fallback pages.
   */
  isFallback?: boolean;
}

/**
 * Create a `DocMetainfoArea` component from the unified {@link ChromeContext}
 * (epic Collapse Wiring Shells #2420, FACTORIES #2424 — breaking signature).
 *
 * Reads `settings`/`defaultLocale`/`t` directly and `toHistorySlug` from the
 * package slug helper; the per-page git-history manifest is a HOST-bound slot
 * (`ctx.hostBindings.docHistoryMeta`, default `{}` → no Created/Updated block).
 */
export function createDocMetainfoArea<S extends Settings = Settings>(
  ctx: ChromeContext<S>,
): (props: DocMetainfoAreaProps) => VNode | null {
  assertChromeContext(ctx, "createDocMetainfoArea");
  const settings = ctx.settings as unknown as DocMetainfoAreaSettings;
  const defaultLocale = ctx.defaultLocale;
  const docHistoryMeta = (ctx.hostBindings.docHistoryMeta ?? {}) as Record<
    string,
    DocHistoryMetaEntry
  >;
  const t = ctx.t;
  const dateFormatsFor = deriveDateFormats(ctx);

  function DocMetainfoArea({ slug, locale, isFallback }: DocMetainfoAreaProps): VNode | null {
    if (!settings.docMetainfo) return null;

    // Keep the pre-setting behavior for contexts that omit the optional field;
    // `zudoDoc()` supplies all three by default, while direct factory callers
    // from before this setting existed still render the complete block.
    const fields = settings.docMetainfoFields;
    const showCreated = fields === undefined || fields.includes("created");
    const showUpdated = fields === undefined || fields.includes("updated");
    const showAuthor = fields === undefined || fields.includes("author");

    // Avoid looking up history or creating an empty wrapper when every field
    // was explicitly deselected.
    if (!showCreated && !showUpdated && !showAuthor) return null;

    // Doc-history storage sentinel ("" -> "index"): a root index page has the
    // canonical route slug "" (→ /docs/), but the prebuild keys the root entry
    // under "index" (collectContentFiles keeps the bare root; an empty path
    // segment is unroutable). Apply the sentinel BEFORE locale composition so
    // the visible Created/Updated/Author block resolves for a root page — see
    // @takazudo/zudo-doc/slug `toHistorySlug` and _doc-history-area.tsx. (#1891)
    const historySlug = toHistorySlug(slug);

    // On EN-fallback locale pages the manifest only has the bare
    // (non-locale-prefixed) key — the prebuild writes locale-prefixed keys
    // only for files physically present in the locale collection. Use
    // defaultLocale for the data lookup when isFallback is true, mirroring
    // `effectiveHistoryLocale` in _doc-history-area.tsx so the visible block
    // and the dropdown agree. Display formatting keeps the active locale.
    const effectiveHistoryLocale = isFallback ? defaultLocale : locale;

    // Key format: bare slug for default locale, "<locale>/<slug>" for others.
    // Matches the prebuild step's composedSlug logic (pre-build.ts).
    const composedSlug =
      effectiveHistoryLocale === defaultLocale
        ? historySlug
        : `${effectiveHistoryLocale}/${historySlug}`;

    const meta = docHistoryMeta[composedSlug];

    // Pages matched by docHistoryExclude are intentionally absent from the manifest.
    if (!meta) return null;

    return (
      <DocMetainfo
        createdAt={
          showCreated && meta.createdDate
            ? formatDate(meta.createdDate, locale, dateFormatsFor(locale).full)
            : null
        }
        updatedAt={
          showUpdated && meta.updatedDate
            ? formatDate(meta.updatedDate, locale, dateFormatsFor(locale).full)
            : null
        }
        author={showAuthor ? meta.author || null : null}
        createdLabel={t("doc.created", locale)}
        updatedLabel={t("doc.updated", locale)}
      />
    );
  }

  return DocMetainfoArea;
}
