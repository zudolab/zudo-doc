/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Locked manifest (#2653 Decision 4, i18n addendum): the locale-prefixed
// counterpart of pages/docs/[[...slug]].tsx — required for the same reason
// (injected DYNAMIC routes 404 in `zfb dev`). Self-contained: only the three
// sanctioned package entrypoints — no `pages/lib`, no `@/config`. Mirrors
// the package's own `routes/locale-docs-slug.tsx` shape, rebuilt from the
// route-context payload instead of the package-internal `_context.js`.
//
// docHistory note: same as the default-locale stub — when docHistory is
// selected, the generator patches this file too.

import type { JSX } from "preact";
import { routeContext } from "virtual:zudo-doc-route-context";
import {
  createRouteContext,
  type RouteContextPayload,
} from "@takazudo/zudo-doc/route-context";
import { createChrome } from "@takazudo/zudo-doc/chrome";

const ctx = routeContext as unknown as RouteContextPayload;
const routeCtx = createRouteContext(ctx);
const { renderDocPage } = createChrome(routeCtx);

export const frontmatter = { title: "Docs" };

export function paths(): Array<{
  params: { locale: string; slug: string[] };
  props: unknown;
}> {
  const result: Array<{
    params: { locale: string; slug: string[] };
    props: unknown;
  }> = [];

  for (const locale of Object.keys(routeCtx.settings.locales)) {
    const source = routeCtx.resolveNavSource(locale, undefined, {
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });
    for (const item of routeCtx.buildDocRouteEntries({
      source,
      locale,
      routeSig: `locale-docs;${locale}`,
    })) {
      result.push({ params: { locale, slug: item.slugParams }, props: item.props });
    }
  }

  return result;
}

type PageArgs = { params: { locale: string; slug: string[] } } &
  Record<string, unknown>;

export default function LocaleDocsPage(props: PageArgs): JSX.Element {
  return renderDocPage(props as never, {
    locale: props.params.locale,
    docHistoryContentDir: routeCtx.settings.docsDir,
  });
}
