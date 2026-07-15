/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// doc-history-area — factory for the locale-aware DocHistory area wrapper
// (epic #2344, S7).
//
// The host's `pages/lib/_doc-history-area.tsx` previously read
// `settings.docHistory`, `settings.bodyFootUtilArea`, `settings.base`,
// `defaultLocale`, and imported `buildGitHubSourceUrl` from `@/utils/github`
// (which itself read `settings.githubUrl` at module scope). This factory
// receives all these as injected dependencies.
//
// DocHistory island: the host stub must still import `DocHistory` from
// `@takazudo/zudo-doc/doc-history` so zfb's scanner walks the page →
// stub → DocHistory chain. The factory receives the DocHistory constructor via
// deps so no `@/` alias is imported here.
//
// docHistoryMeta JSON: stays in the host stub — the `#doc-history-meta` alias
// resolves only in the host project's tsconfig. The factory receives the parsed
// manifest as a plain object.

import type { VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { BodyFootUtilArea } from "../body-foot-util/index.js";
import type { ChromeContext } from "../factory-context/index.js";
import type { Settings } from "../settings.js";
import { toHistorySlug } from "../slug/index.js";
import { buildGitHubSourceUrl as buildGitHubSourceUrlBase } from "../github-helpers/index.js";
import { deriveDocHistorySlot } from "../chrome/derive.js";
import { assertChromeContext } from "../chrome/assert-chrome-context.js";

/** Per-entry metadata shape from the doc-history manifest. */
export interface DocHistoryMetaEntry {
  author: string;
  createdDate: string;
  updatedDate: string;
  /** Source file extension recorded by the current build-time manifest. */
  ext: ".mdx" | ".md";
}

/** Settings subset read by the DocHistoryArea factory. */
export interface DocHistoryAreaSettings {
  docHistory: boolean;
  bodyFootUtilArea: { viewSourceLink?: boolean } | false | undefined;
  base?: string | null;
}

/**
 * DocHistory component constructor type.
 * Must match the interface of `@takazudo/zudo-doc/doc-history`'s DocHistory.
 */
export type DocHistoryComponent = (props: {
  slug: string;
  locale?: string;
  basePath?: string;
}) => VNode;

export interface DocHistoryAreaProps {
  /** Page slug, e.g. "getting-started/intro". */
  slug: string;
  /** Active locale string, e.g. "en", "ja". */
  locale: string;
  /**
   * Raw zfb entry slug (relative path without extension), e.g.
   * "getting-started/intro" or "getting-started/index". Appended with
   * the source extension from the build-time manifest to form the file path
   * passed to buildGitHubSourceUrl.
   * Omit for auto-index pages (no underlying MDX file) — sourceUrl
   * will be suppressed automatically.
   */
  entrySlug?: string;
  /**
   * Source extension from the current content entry. Used only when the file
   * has no manifest metadata yet (for example, an untracked file or a build
   * with `SKIP_DOC_HISTORY=1`). A present manifest owns its required `ext`.
   */
  sourceFileExt?: ".mdx" | ".md";
  /**
   * Content directory for the active locale, e.g. "src/content/docs"
   * or "src/content/docs-ja". Combined with entrySlug to build the
   * view-source GitHub URL. Omit to suppress the view-source link.
   */
  contentDir?: string;
  /**
   * True when this locale page falls back to the base EN collection
   * (i.e. the slug has no translation for the active locale). When true,
   * the history data-path derivations use defaultLocale so the island
   * fetches the correct bare-slug JSON and the SSR manifest lookup hits
   * the bare key — both of which only exist for EN-origin files.
   */
  isFallback?: boolean;
}

/**
 * Create a `DocHistoryArea` component from the unified {@link ChromeContext}
 * (epic Collapse Wiring Shells #2420, FACTORIES #2424 — breaking signature).
 *
 * Reads `settings`/`defaultLocale`/`t` directly, `toHistorySlug` from the slug
 * helper, and binds `buildGitHubSourceUrl` to `settings.githubUrl`. The
 * DocHistory island is a HOST-bound slot (`ctx.hostBindings.DocHistory`,
 * default: a no-op stub rendering an empty fragment).
 */
export function createDocHistoryArea<S extends Settings = Settings>(
  ctx: ChromeContext<S>,
): (props: DocHistoryAreaProps) => VNode | null {
  assertChromeContext(ctx, "createDocHistoryArea");
  const settings = ctx.settings as unknown as DocHistoryAreaSettings;
  const defaultLocale = ctx.defaultLocale;
  const docHistoryMeta = (ctx.hostBindings.docHistoryMeta ?? {}) as Record<
    string,
    DocHistoryMetaEntry
  >;
  const t = ctx.t;
  const buildGitHubSourceUrl = (contentDir: string, entryId: string): string | null =>
    buildGitHubSourceUrlBase(
      (ctx.settings as { githubUrl?: string | false }).githubUrl,
      contentDir,
      entryId,
    );
  const DocHistory = deriveDocHistorySlot(ctx) as unknown as DocHistoryComponent;

  // Set explicit `displayName` on the named-export DocHistory so zfb's
  // `captureComponentName` produces a stable marker even after the SSR
  // pipeline runs the component through a function-name-rewriting layer.
  (DocHistory as { displayName?: string }).displayName = "DocHistory";

  function DocHistoryArea({
    slug,
    locale,
    entrySlug,
    sourceFileExt,
    contentDir,
    isFallback,
  }: DocHistoryAreaProps): VNode | null {
    if (!settings.docHistory) return null;

    // Doc-history storage sentinel ("" -> "index"): a root index page has the
    // canonical route slug "" (→ /docs/), but doc-history JSON and the meta
    // manifest store/serve the root entry under "index" (an empty path segment
    // is unroutable — the server regex and the prebuild key composition both
    // reject ""). Apply the sentinel to the slug segment BEFORE locale
    // composition so root pages resolve to e.g. /doc-history/index.json and the
    // meta key "ja/index". See @/utils/slug `toHistorySlug` and the
    // collectContentFiles walk in packages/doc-history-server. (#1891)
    const historySlug = toHistorySlug(slug);

    // On EN-fallback locale pages the history data exists only at the bare
    // (non-locale-prefixed) path — the prebuild/server writes locale-prefixed
    // keys/paths only for files physically present in the locale collection.
    // Use defaultLocale for data lookups when isFallback is true; keep locale
    // for all display label calls (t()) so JA users see JA labels.
    const effectiveHistoryLocale = isFallback ? defaultLocale : locale;

    // Look up the build-time manifest entry for this page. The composedSlug
    // matches the key written by the prebuild step: bare slug for the default
    // locale, "<localeKey>/<slug>" for non-default locales.
    const composedSlug =
      effectiveHistoryLocale === defaultLocale ? historySlug : `${effectiveHistoryLocale}/${historySlug}`;
    const meta = docHistoryMeta[composedSlug];

    // Locale-aware labels for the SSR fallback.
    const createdLabel = t("doc.created", locale);
    const updatedLabel = t("doc.updated", locale);
    const historyLabel = t("doc.history", locale);

    // Real-component props — locale omitted for the default locale.
    // Use effectiveHistoryLocale so fallback pages fetch the bare (non-ja/) path.
    const docHistoryLocale = effectiveHistoryLocale === defaultLocale ? undefined : effectiveHistoryLocale;
    const docHistoryBasePath = settings.base ?? "/";

    // Build the SSR fallback with only the sr-only metadata block so the
    // author marker and Created/Updated labels are present in SSG output
    // before JS hydration, discoverable by screen readers and crawlers.
    const author = meta?.author;
    const createdDate = meta?.createdDate;
    const updatedDate = meta?.updatedDate;

    const fallback = (
      <div class="sr-only">
        {author && <span>{author}</span>}
        <span>
          {createdLabel}
          {createdDate ? `: ${createdDate}` : ""}
        </span>
        <span>
          {updatedLabel}
          {updatedDate ? `: ${updatedDate}` : ""}
        </span>
      </div>
    );

    // Compose the SSR-skip island with zfb's native `<Island ssrFallback>` API.
    const docHistoryIsland = Island({
      when: "idle",
      ssrFallback: fallback,
      children: (
        <DocHistory
          slug={historySlug}
          locale={docHistoryLocale}
          basePath={docHistoryBasePath}
        />
      ),
    }) as unknown as VNode;

    // Compute the view-source GitHub URL host-side so the v2 BodyFootUtilArea
    // component stays oblivious to project settings. Gate on
    // bodyFootUtilArea.viewSourceLink, and require both entrySlug and contentDir
    // (auto-index pages pass neither). The real source extension comes from the
    // build-time manifest (`ext`, written by pre-build.ts) — the content walkers
    // accept both .mdx and .md, so hardcoding ".mdx" produced broken view-source
    // URLs for .md pages. An absent manifest (untracked file or
    // SKIP_DOC_HISTORY=1) uses the extension supplied explicitly from the
    // current content entry; it is not treated as an old-manifest fallback.
    const utilSettings = settings.bodyFootUtilArea;
    const sourceExt = meta ? meta.ext : sourceFileExt;
    const sourceUrl =
      utilSettings &&
      utilSettings.viewSourceLink &&
      entrySlug &&
      sourceExt &&
      contentDir
        ? buildGitHubSourceUrl(contentDir, entrySlug + sourceExt)
        : null;

    // Resolve the i18n label host-side; pass the result so the v2 component
    // stays framework-agnostic.
    const viewSourceLabel = t("doc.viewSource", locale);

    // Suppress TS warning about historyLabel being unused — it is retained
    // for future use and parity with the original file.
    void historyLabel;

    return (
      <BodyFootUtilArea
        docHistoryIsland={docHistoryIsland}
        sourceUrl={sourceUrl}
        viewSourceLabel={viewSourceLabel}
      />
    );
  }

  return DocHistoryArea;
}
