/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Self-contained doc-route stub (#2653 Decision 4 correction; locked form
// #2660) — see pages/docs/[[...slug]].tsx for the full rationale (injected
// DYNAMIC routes 404 in `zfb dev`; this file keeps `pnpm dev` working on
// `/[locale]/docs/...`). Non-default-locale catch-all: `paths()` emits one
// route per (non-default locale, slug) with the locale-first + base-EN-
// fallback merge.
//
// Same three sanctioned package entrypoints as the default-locale stub, plus
// the `virtual:zudo-doc-chrome-bindings` host-callables channel for the
// showcase's real chrome slots — no `pages/lib`, no `@/config`.

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

interface LocaleDocPageExtra {
  contentDir: string;
  isFallback: boolean;
}

type DocPageProps =
  | (DocPageEntryProps & LocaleDocPageExtra)
  | (DocPageAutoIndexProps & LocaleDocPageExtra);

export function paths(): Array<{
  params: { locale: string; slug: string[] };
  props: DocPageProps;
}> {
  const result: Array<{
    params: { locale: string; slug: string[] };
    props: DocPageProps;
  }> = [];

  for (const locale of Object.keys(routeCtx.settings.locales)) {
    const contentDir = routeCtx.getLocaleConfig(locale)?.dir ?? routeCtx.settings.docsDir;
    const source = routeCtx.resolveNavSource(locale, undefined, {
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });

    for (const item of routeCtx.buildDocRouteEntries({
      source,
      locale,
      routeSig: `locale-docs;${locale}`,
    })) {
      const extra: LocaleDocPageExtra = {
        contentDir: item.isFallback ? routeCtx.settings.docsDir : contentDir,
        isFallback: item.isFallback,
      };
      result.push({
        params: { locale, slug: item.slugParams },
        props: { ...(item.props as DocPageProps), ...extra },
      });
    }
  }

  return result;
}

type PageArgs = DocPageProps & { params: { locale: string; slug: string[] } };

export default function LocaleDocsPage(props: PageArgs): JSX.Element {
  return renderDocPage(props, {
    locale: props.params.locale,
    isFallback: props.isFallback,
    docHistoryContentDir: props.contentDir,
  });
}
