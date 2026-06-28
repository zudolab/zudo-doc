/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host ChromeContext — the unified context the refactored public factories now
// derive their bag from (epic Collapse Wiring Shells #2420, FACTORIES #2424).
//
// The package factories took wide param bags before; they now take the single
// `ChromeContext` and derive everything internally. This module is the host
// adapter that builds that context ONCE from the project's real values:
//
//   - the reconstructed route context via the public `createRouteContext`
//     (settings + i18n + URL helpers + nav/slug helpers + nav-source resolvers),
//     fed the project's serializable payload and the host content bridge
//     (`stableDocs`) so the content read + nav enumeration stay byte-identical;
//   - the genuinely host-bound slots (`hostBindings`): the real SearchWidget,
//     git-history manifest, sidebars config, frontmatter renderers/builder,
//     footer tag loader + vocabulary, body-end islands, DocHistory island, and
//     the showcase MDX content overrides.
//
// Each `pages/lib/_*` chrome shell now calls `createX(chromeCtx)`; the data
// shells (`_nav-source-docs` / `_doc-route-entries` / `route-enumerators`)
// re-export their results off this same context. This per-call-site wiring is
// the raw material HOSTCOLLAPSE (#2427) will dedupe into one adapter.

import type { ComponentChildren, VNode } from "preact";
import { createRouteContext } from "@takazudo/zudo-doc/route-context";
import type { ChromeContext, ChromeHostBindings } from "@takazudo/zudo-doc/factory-context";
import type { ColorScheme } from "@takazudo/zudo-doc/color-scheme-utils";

import { settings } from "@/config/settings";
import { translations, defaultLocale } from "@/config/i18n";
import { tagVocabulary } from "@/config/tag-vocabulary";
import { colorSchemes } from "@/config/color-schemes";
import sidebars from "@/config/sidebars";
import { frontmatterRenderers } from "@/config/frontmatter-preview-renderers";
import { collectTags } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import type { DocsEntry } from "@/types/docs-entry";

import { stableDocs, memoizeDerived } from "./_nav-source-cache";
import { mergeLocaleDocs } from "./locale-merge";
import { SearchWidget } from "./_search-widget";
import { BodyEndIslands } from "./_body-end-islands";
import { buildFrontmatterPreviewEntries } from "./_frontmatter-preview-data";
import { DetailsWrapper } from "./_details";
import { PresetGeneratorFallback } from "./_preset-generator";
import { DocHistory } from "@takazudo/zudo-doc/doc-history";
import { HtmlPreviewWrapper, type HtmlPreviewWrapperProps } from "@takazudo/zudo-doc/html-preview-wrapper";
// SSR author + date metadata — see _doc-metainfo-area.tsx for the `#doc-history-meta`
// alias rationale (build-time manifest, esbuild-inlined, no fs).
import docHistoryMeta from "#doc-history-meta";

// ---------------------------------------------------------------------------
// Footer tag loader (host-side; moved from _footer-with-defaults.tsx). Reads
// collections via stableDocs / memoizeDerived and aggregates tags per locale.
// ---------------------------------------------------------------------------

function loadTagsForLocale(lang: string) {
  if (lang === defaultLocale) {
    const baseDocs = stableDocs("docs");
    return memoizeDerived([baseDocs], "footerTaglist;default", () => {
      const docs: DocsEntry[] = baseDocs.filter(
        (d) => !d.data.draft && !d.data.unlisted && !d.data.category_no_page,
      );
      const tagMap = collectTags(docs, (id, data) => data.slug ?? toRouteSlug(id));
      return [...tagMap.values()].sort((a, b) => a.tag.localeCompare(b.tag, lang));
    });
  }
  const baseDocs = stableDocs("docs");
  const localeDocs = stableDocs(`docs-${lang}`);
  return memoizeDerived([baseDocs, localeDocs], `footerTaglist;${lang}`, () => {
    const result = mergeLocaleDocs({
      baseDocs: baseDocs.filter((d) => !d.data.draft),
      localeDocs: localeDocs.filter((d) => !d.data.draft),
      applyDefaultLocaleOnlyFilter: true,
    });
    const docs: DocsEntry[] = result.docs.filter((d) => !d.data.category_no_page);
    const tagMap = collectTags(docs, (id, data) => data.slug ?? toRouteSlug(id));
    return [...tagMap.values()].sort((a, b) => a.tag.localeCompare(b.tag, lang));
  });
}

// ---------------------------------------------------------------------------
// Showcase MDX content overrides (host-bound; identical to the `extras` block
// of pages/_mdx-components.ts — kept in lockstep). Threaded via
// `hostBindings.mdxExtras`; the package factory merges them over its defaults.
// ---------------------------------------------------------------------------

/** MDX-tag stub: renders nothing (Preact null-vnode path). */
const MdxStub = (_props: unknown) => null;

/** SSR pass-through for `<Island when=…>` — renders children, ignores `when`. */
function IslandWrapper(props: {
  when?: "load" | "idle" | "visible" | "media";
  children?: ComponentChildren;
}): ComponentChildren {
  return props.children ?? null;
}

const HtmlPreviewWithGlobalConfig = (props: HtmlPreviewWrapperProps) =>
  HtmlPreviewWrapper({ globalConfig: settings.htmlPreview ?? null, ...props });

const mdxExtras = {
  HtmlPreview: HtmlPreviewWithGlobalConfig,
  Details: DetailsWrapper,
  SmartBreak: MdxStub,
  Island: IslandWrapper,
  PresetGenerator: PresetGeneratorFallback,
  Avatar: MdxStub,
  Button: MdxStub,
  Card: MdxStub,
  MyComponent: MdxStub,
  PageLayout: MdxStub,
} as unknown as Record<string, (props: Record<string, unknown>) => unknown>;

// ---------------------------------------------------------------------------
// The unified ChromeContext.
// ---------------------------------------------------------------------------

const routeContext = createRouteContext(
  {
    settings,
    translations,
    tagVocabulary,
    colorSchemes: colorSchemes as unknown as Record<string, ColorScheme>,
  },
  // Pass the host content bridge so the docs read + nav enumeration match the
  // project's existing `pages/*` paths() exactly (host `bridgeDocsEntries` over
  // the `zfb/content` snapshot), not the package default.
  { stableDocs },
);

const hostBindings: ChromeHostBindings = {
  SearchWidget: SearchWidget as ChromeHostBindings["SearchWidget"],
  docHistoryMeta: docHistoryMeta as Record<string, unknown>,
  sidebarsConfig: sidebars as unknown as Record<string, unknown>,
  frontmatterRenderers: frontmatterRenderers as unknown as ChromeHostBindings["frontmatterRenderers"],
  buildFrontmatterPreviewEntries:
    buildFrontmatterPreviewEntries as unknown as ChromeHostBindings["buildFrontmatterPreviewEntries"],
  loadTagsForLocale: loadTagsForLocale as unknown as ChromeHostBindings["loadTagsForLocale"],
  tagVocabulary,
  BodyEndIslands: BodyEndIslands as unknown as ChromeHostBindings["BodyEndIslands"],
  DocHistory: DocHistory as unknown as ChromeHostBindings["DocHistory"],
  mdxExtras: mdxExtras as ChromeHostBindings["mdxExtras"],
};

/** The host's unified ChromeContext — every `pages/lib/_*` factory shell derives
 *  its wiring from this single object. */
export const chromeCtx: ChromeContext = {
  ...(routeContext as unknown as ChromeContext),
  components: {},
  hostBindings,
};

export type { VNode };
