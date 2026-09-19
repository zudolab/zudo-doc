/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// FIXTURE-OWNED chrome bindings for the `hostpanel` e2e fixture (#4310, epic
// #4309). `e2e/setup-fixtures.sh` materializes THIS file as the fixture's
// `src/chrome-bindings.tsx` (the `chromeBindingsModule` target) instead of
// copying the repo-root one — it is the only fixture that owns its bindings.
//
// It is a copy of the repo-root `src/chrome-bindings.tsx` with exactly two
// additions, because the copied `pages/` stubs import every slot the showcase
// routes need and all of them must still resolve:
//   1. `BodyEndIslands` additionally mounts the host-owned design-token-panel
//      island (`src/host-panel/bootstrap-island.tsx`) in `Island({ when: "load" })`;
//   2. `headerRightComponents["host-token-trigger"]` renders the host's own
//      trigger button, since `designTokenPanel: false` drops the package's.
//
// Keep the rest in lockstep with the repo-root file when that one changes.

import type { ComponentChildren, JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
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
import {
  BodyEndIslands as BodyEndIslandsSeam,
  type BodyEndIslandsProps,
} from "../pages/lib/_body-end-islands";
import { DetailsWrapper } from "../pages/lib/_details";
import { PresetGeneratorFallback } from "../pages/lib/_preset-generator";
import { DocHistory } from "@takazudo/zudo-doc/doc-history";
// SSR author + date metadata — `#doc-history-meta` is the build-time manifest
// alias (esbuild-inlined, no fs). Static import is load-bearing for the island
// scanner chain noted below.
import docHistoryMeta from "#doc-history-meta";

// Fixture-owned host panel (#4310). Both imports MUST stay static: zfb's island
// scanner walks chromeBindings -> here -> the "use client" island module, and a
// dynamic or type-only import silently kills island registration.
import { HostPanelBootstrap } from "./host-panel/bootstrap-island.js";
import { HostTokenTrigger } from "./host-panel/trigger.js";

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

const mdxExtras = {
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
// Host-owned design-token-panel island (#4310). The package mounts none of its
// own here (`designTokenPanel: false`), so this wrapper composes the showcase's
// body-end islands with the fixture's bootstrap island. `Island({ when: "load" })`
// mirrors the package's own panel mount shape in
// `packages/zudo-doc/src/doc-body-end-islands/design-token-panel-island.tsx`.
// ---------------------------------------------------------------------------

function BodyEndIslandsWithHostPanel(props: BodyEndIslandsProps): JSX.Element {
  return (
    <>
      <BodyEndIslandsSeam {...props} />
      {
        Island({
          when: "load",
          children: <HostPanelBootstrap />,
        }) as unknown as VNode
      }
    </>
  );
}

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
  BodyEndIslands: BodyEndIslandsWithHostPanel,
  // Resolves `settings.headerRightItems`' serialized
  // `{ type: "component", component: "host-token-trigger" }` entry.
  headerRightComponents: {
    "host-token-trigger": () => <HostTokenTrigger />,
  },
  DocHistory,
  mdxExtras,
});
