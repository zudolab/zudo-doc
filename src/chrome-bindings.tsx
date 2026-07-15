/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The showcase's real host-bound chrome slots — the sanctioned
// `chromeBindingsModule` seam (ADR "Host-callables channel — chromeBindingsModule",
// packages/zudo-doc/docs/adr/route-injection-seam.md; #2501). Wired via
// `settings.chromeBindingsModule` in zfb.config.ts, this module is re-exported
// through the `virtual:zudo-doc-chrome-bindings` module the routes plugin
// registers, and consumed by:
//   - the 4 self-contained doc-route stubs (pages/docs/[[...slug]].tsx and its
//     [locale]/v/** variants), which call `createChrome(routeCtx, chromeBindings)`;
//   - the minimal `pages/lib/_chrome.ts` (home-page HomePageView consumer).
//
// This is the direct successor of the deleted `pages/lib/_chrome.ts`'s
// `hostBindings` object (epic zudolab/zudo-doc#2651, Wave 6 #2661) — same real
// bindings (SearchWidget, git-history manifest, sidebars config, frontmatter
// renderers/builder, footer tag loader + vocabulary, body-end islands,
// DocHistory island, and the showcase MDX content overrides), just moved from
// a `createChrome(...)`-calling module to a plain bindings-exporting one (the
// route context / `createChrome` call itself now lives at each consumer, per
// the locked self-contained-stub shape — #2653 decision wave).

import type { ComponentChildren } from "preact";
import { defineChromeBindings } from "@takazudo/zudo-doc/chrome-bindings";

import { settings } from "@/config/settings";
import { defaultLocale } from "@/config/i18n";
import { tagVocabulary } from "@/config/tag-vocabulary";
import sidebars from "@/config/sidebars";
import { frontmatterRenderers } from "@/config/frontmatter-preview-renderers";
import { createBuildFrontmatterPreviewEntries } from "@takazudo/zudo-doc/frontmatter-preview-data";
import { defaultFrontmatterPreviewIgnoreKeys } from "@takazudo/zudo-doc/frontmatter-preview-defaults";
import { collectTags } from "@/utils/tags";
import { toRouteSlug } from "@takazudo/zudo-doc/slug";
import type { DocPageEntry } from "@takazudo/zudo-doc/doc-page-props";
import { mergeLocaleDocs } from "@takazudo/zudo-doc/locale-merge";
import { isDefaultLocaleOnlyPath } from "@/utils/base";

import { stableDocs, memoizeDerived } from "../pages/lib/_nav-source-cache";
import { SearchWidget } from "../pages/lib/_search-widget";
import { BodyEndIslands as BodyEndIslandsSeam } from "../pages/lib/_body-end-islands";
import { DetailsWrapper } from "../pages/lib/_details";
import { PresetGeneratorFallback } from "../pages/lib/_preset-generator";
import { DocHistory } from "@takazudo/zudo-doc/doc-history";
import { HtmlPreviewWrapper, type HtmlPreviewWrapperProps } from "@takazudo/zudo-doc/html-preview-wrapper";
// SSR author + date metadata — `#doc-history-meta` is the build-time manifest
// alias (esbuild-inlined, no fs). Static import is load-bearing for the island
// scanner chain noted below.
import docHistoryMeta from "#doc-history-meta";

// ---------------------------------------------------------------------------
// Frontmatter-preview entry builder (moved verbatim from the former
// pages/lib/_frontmatter-preview-data.ts, deleted — it existed only to feed
// this binding). Threaded as hostBindings.buildFrontmatterPreviewEntries.
// ---------------------------------------------------------------------------

const buildFrontmatterPreviewEntries = createBuildFrontmatterPreviewEntries({
  frontmatterPreview: settings.frontmatterPreview,
  defaultIgnoreKeys: defaultFrontmatterPreviewIgnoreKeys,
});

// ---------------------------------------------------------------------------
// Footer tag loader (host-side; moved verbatim from the former
// _footer-with-defaults.tsx via the deleted pages/lib/_chrome.ts). Reads
// collections via stableDocs / memoizeDerived and aggregates tags per locale.
// Threaded as hostBindings.loadTagsForLocale.
// ---------------------------------------------------------------------------

function loadTagsForLocale(lang: string) {
  if (lang === defaultLocale) {
    const baseDocs = stableDocs("docs");
    return memoizeDerived([baseDocs], "footerTaglist;default", () => {
      const docs: DocPageEntry[] = baseDocs.filter(
        (d) => !d.data.draft && !d.data.unlisted && !d.data.category_no_page,
      );
      const tagMap = collectTags(
        docs,
        (entrySlug, data) => data.slug ?? toRouteSlug(entrySlug),
      );
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
      isDefaultLocaleOnlyPath,
    });
    const docs: DocPageEntry[] = result.docs.filter((d) => !d.data.category_no_page);
    const tagMap = collectTags(
      docs,
      (entrySlug, data) => data.slug ?? toRouteSlug(entrySlug),
    );
    return [...tagMap.values()].sort((a, b) => a.tag.localeCompare(b.tag, lang));
  });
}

// ---------------------------------------------------------------------------
// Showcase MDX content overrides (host-bound; identical to the former
// pages/_mdx-components.ts `extras` block — kept in lockstep). Threaded via
// hostBindings.mdxExtras; the package factory merges them over its defaults.
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
};

// ---------------------------------------------------------------------------
// The host's real bindings (the 10 ChromeHostBindings slots). Built via
// `defineChromeBindings` (#2694/#2695) so each slot is checked against its
// real call-side prop contract at compile time — see
// `packages/zudo-doc/src/chrome-bindings.ts` for the rationale.
// ---------------------------------------------------------------------------

export const chromeBindings = defineChromeBindings({
  SearchWidget,
  docHistoryMeta,
  sidebarsConfig: sidebars,
  frontmatterRenderers,
  buildFrontmatterPreviewEntries,
  loadTagsForLocale,
  tagVocabulary,
  BodyEndIslands: BodyEndIslandsSeam,
  DocHistory,
  mdxExtras,
});
