/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Self-contained doc-route stub (#2653 Decision 4 correction; locked form
// #2660) — see pages/docs/[[...slug]].tsx for the full rationale (injected
// DYNAMIC routes 404 in `zfb dev`; this file keeps `pnpm dev` working on
// `/v/<ver>/docs/...`). Versioned EN docs route: `paths()` enumerates one
// route per (version, slug) over the `docs-v-${version.slug}` collection.
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

interface VersionedDocPageExtra {
  version: VersionConfig;
}

type DocPageProps =
  | (DocPageEntryProps & VersionedDocPageExtra)
  | (DocPageAutoIndexProps & VersionedDocPageExtra);

export function paths(): Array<{
  params: { version: string; slug: string[] };
  props: DocPageProps;
}> {
  if (!routeCtx.settings.versions) return [];

  const result: Array<{
    params: { version: string; slug: string[] };
    props: DocPageProps;
  }> = [];

  for (const version of routeCtx.settings.versions) {
    const source = routeCtx.resolveNavSource(routeCtx.defaultLocale, version.slug);
    const urlFor = (s: string): string => routeCtx.versionedDocsUrl(s, version.slug);

    for (const item of routeCtx.buildDocRouteEntries({
      source,
      locale: routeCtx.defaultLocale,
      routeSig: `v-docs;${version.slug}`,
      urlFor,
    })) {
      result.push({
        params: { version: version.slug, slug: item.slugParams },
        props: { ...(item.props as DocPageProps), version },
      });
    }
  }

  return result;
}

type PageArgs = DocPageProps & { params: { version: string; slug: string[] } };

export default function VersionedDocsPage(props: PageArgs): JSX.Element {
  return renderDocPage(props, {
    locale: routeCtx.defaultLocale,
    version: props.version,
  });
}
