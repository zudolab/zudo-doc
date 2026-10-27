import type { HeaderSlotProps, SidebarSlotProps } from "@takazudo/zudo-doc/chrome-bindings";
import type { DocPageEntry } from "@takazudo/zudo-doc/doc-page-props";
import type {
  ChromeContext,
  ChromeHostBindings,
  RouteContext,
} from "@takazudo/zudo-doc/factory-context";
import { createHeaderWithDefaults } from "@takazudo/zudo-doc/header-with-defaults";
import { createSidebarWithDefaults } from "@takazudo/zudo-doc/sidebar-with-defaults";
import {
  toUmbrellaTree,
  umbrellaSections,
  umbrellaSidebar,
  type UmbrellaNavigation,
} from "./learn-navigation";

interface ChromePair {
  Header: ReturnType<typeof createHeaderWithDefaults>;
  Sidebar: ReturnType<typeof createSidebarWithDefaults>;
}

const pairOf = (context: ChromeContext): ChromePair => ({
  Header: createHeaderWithDefaults(context),
  Sidebar: createSidebarWithDefaults(context),
});

/**
 * Header and Sidebar replacements for umbrella sections. Every section of an
 * umbrella renders the same one-root forest; only its node-mode baseline
 * differs. A locale or version without the umbrella's root page, and every
 * other section, keeps the native pair with its original sidebar definitions.
 * Each pair shares one context, so the desktop sidebar and the mobile drawer
 * receive the same data.
 */
export function createUmbrellaChrome(
  routeCtx: RouteContext,
  bindings: ChromeHostBindings,
  umbrellas: readonly UmbrellaNavigation[],
) {
  const nativeContext: ChromeContext = { ...routeCtx, components: {}, hostBindings: bindings };
  const native = pairOf(nativeContext);
  const pairs = new Map<string, ChromePair>();

  function pairFor(lang: string, navSection: string | undefined, currentVersion: string | undefined): ChromePair {
    const umbrella = navSection === undefined
      ? undefined
      : umbrellas.find((candidate) => umbrellaSections(candidate).includes(navSection));
    if (!umbrella || navSection === undefined) return native;
    // Decide from the same native source and tree the factories render.
    const { navDocs, categoryMeta } = routeCtx.loadNavSourceDocs(lang, currentVersion);
    const tree = routeCtx.buildNavTree(
      navDocs as DocPageEntry[],
      lang,
      categoryMeta,
      (slug, locale) => routeCtx.docsUrl(slug, locale),
    );
    const forest = toUmbrellaTree(tree, umbrella);
    const definition = forest && umbrellaSidebar(forest, navSection);
    if (!definition) return native;

    const key = `${navSection}:${definition.initialPath?.join(".")}`;
    let pair = pairs.get(key);
    if (!pair) {
      pair = pairOf({
        ...nativeContext,
        hostBindings: {
          ...bindings,
          sidebarsConfig: { ...bindings.sidebarsConfig, [navSection]: definition },
        },
        // Forward every argument so locale, base and href building stay native.
        buildNavTree: (...args) => {
          const nativeTree = routeCtx.buildNavTree(...args);
          return toUmbrellaTree(nativeTree, umbrella) ?? nativeTree;
        },
      });
      pairs.set(key, pair);
    }
    return pair;
  }

  return {
    Header: (props: HeaderSlotProps) => pairFor(props.lang, props.navSection, props.currentVersion).Header(props),
    Sidebar: (props: SidebarSlotProps) => pairFor(props.lang, props.navSection, props.currentVersion).Sidebar(props),
  };
}
