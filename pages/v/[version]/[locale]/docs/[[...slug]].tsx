/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Self-contained doc-route stub (#2653 Decision 4 correction; locked form
// #2660) — see pages/docs/[[...slug]].tsx for the full rationale (injected
// DYNAMIC routes 404 in `zfb dev`; this file keeps `pnpm dev` working on
// `/v/<ver>/<locale>/docs/...`). Versioned non-default-locale docs route:
// `paths()` cross-products `settings.versions` × configured per-version
// locales with a locale-first merge over the version's EN base.
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
import type { VersionConfig } from "@takazudo/zudo-doc/settings";

const ctx = routeContext as unknown as RouteContextPayload;
const routeCtx = createRouteContext(ctx);
const { renderDocPage } = createChrome(routeCtx, chromeBindings);

export const frontmatter = { title: "Docs" };

interface VersionedLocaleDocPageExtra {
  version: VersionConfig;
  contentDir: string;
  isFallback: boolean;
}

type DocPageProps =
  | (DocPageEntryProps & VersionedLocaleDocPageExtra)
  | (DocPageAutoIndexProps & VersionedLocaleDocPageExtra);

export function paths(): Array<{
  params: { version: string; locale: string; slug: string[] };
  props: DocPageProps;
}> {
  if (!routeCtx.settings.versions) return [];

  const result: Array<{
    params: { version: string; locale: string; slug: string[] };
    props: DocPageProps;
  }> = [];

  for (const version of routeCtx.settings.versions) {
    for (const locale of Object.keys(routeCtx.settings.locales)) {
      const localeDir = version.locales?.[locale]?.dir;

      const source = routeCtx.resolveVersionedLocaleSource(
        version.slug,
        version.docsDir,
        locale,
        localeDir,
        { applyDefaultLocaleOnlyFilter: true, keepUnlisted: true },
      );
      const urlFor = (s: string): string => routeCtx.versionedDocsUrl(s, version.slug, locale);

      for (const item of routeCtx.buildDocRouteEntries({
        source,
        locale,
        routeSig: `v-locale-docs;${version.slug};${locale}`,
        urlFor,
      })) {
        const extra: VersionedLocaleDocPageExtra = {
          version,
          contentDir: item.isFallback ? version.docsDir : (localeDir ?? version.docsDir),
          isFallback: item.isFallback,
        };
        result.push({
          params: { version: version.slug, locale, slug: item.slugParams },
          props: { ...(item.props as DocPageProps), ...extra },
        });
      }
    }
  }

  return result;
}

type PageArgs = DocPageProps & {
  params: { version: string; locale: string; slug: string[] };
};

export default function VersionedLocaleDocsPage(props: PageArgs): JSX.Element {
  return renderDocPage(props, {
    locale: props.params.locale,
    version: props.version,
    isFallback: props.isFallback,
  });
}
