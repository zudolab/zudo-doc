/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Self-contained doc-route stub (#2653 Decision 4 correction; locked form
// #2660) — REQUIRED because the injected DYNAMIC `/docs/[[...slug]]` route
// 404s in `zfb dev` (a real pre-existing gap in zfb's dev-mode dynamic-route
// rendering, distinct from the `/`-injection gap zfb#1227; empirically
// confirmed on #2653). Deleting this file in favor of package-route injection
// (the original work-item-2 plan) would build fine but break `pnpm dev` on
// every doc page — so it stays, migrated to this self-contained shape instead.
//
// Reconstructs the doc route from scratch using the three sanctioned package
// entrypoints — no `pages/lib`, no `@/config`:
//   1. `virtual:zudo-doc-route-context` — the serializable settings/
//      translations/tagVocabulary/colorSchemes payload (from zfb.config.ts's
//      `zudoDoc()` call, materialized by the routes plugin);
//   2. `@takazudo/zudo-doc/route-context` (`createRouteContext`);
//   3. `@takazudo/zudo-doc/chrome` (`createChrome`).
// Plus the showcase's real host-bound slots (SearchWidget, DocHistory,
// frontmatter renderers, PresetGenerator, …) via a 4th virtual module,
// `virtual:zudo-doc-chrome-bindings` — the `chromeBindingsModule` host-
// callables channel (ADR "Host-callables channel"), sourced from
// `src/chrome-bindings.tsx` and configured in zfb.config.ts. This is what
// makes this showcase's self-contained stub genuinely showcase-featured
// rather than the bare minimal-scaffold form.
//
// `DesignTokenPanelBootstrap` needs NO explicit threading (#2658 gate-2 fix):
// it is the derive-level default inside `createChrome`, reached through the
// static chain route → `createChrome` → `chrome/derive` → the package's own
// `DesignTokenPanelBootstrap` bootstrap island — see
// packages/zudo-doc/CLAUDE.md.

import type { JSX } from "preact";
import { routeContext } from "virtual:zudo-doc-route-context";
import {
  createRouteContext,
  type RouteContextPayload,
} from "@takazudo/zudo-doc/route-context";
import { createChrome } from "@takazudo/zudo-doc/chrome";
import { chromeBindings } from "virtual:zudo-doc-chrome-bindings";
import type {
  DocPageEntryProps,
  DocPageAutoIndexProps,
} from "@takazudo/zudo-doc/doc-page-props";

const ctx = routeContext as unknown as RouteContextPayload;
const routeCtx = createRouteContext(ctx);
const { renderDocPage } = createChrome(routeCtx, chromeBindings);

export const frontmatter = { title: "Docs" };

type DocPageProps = DocPageEntryProps | DocPageAutoIndexProps;

export function paths(): Array<{
  params: { slug: string[] };
  props: DocPageProps;
}> {
  const locale = routeCtx.defaultLocale;
  const source = routeCtx.resolveNavSource(locale, undefined);
  return routeCtx
    .buildDocRouteEntries({
      source,
      locale,
      routeSig: `docs;${locale}`,
    })
    .map((item) => ({
      params: { slug: item.slugParams },
      props: item.props as DocPageProps,
    }));
}

type PageArgs = DocPageProps & { params: { slug: string[] } };

export default function DocsPage(props: PageArgs): JSX.Element {
  return renderDocPage(props, {
    locale: routeCtx.defaultLocale,
    docHistoryContentDir: routeCtx.settings.docsDir,
  });
}
