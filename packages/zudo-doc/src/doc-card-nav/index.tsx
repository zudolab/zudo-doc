/** @jsxRuntime automatic */
// doc-card-nav — server-side "selected documents" cards.
//
// Selection (an ordered list of canonical document slugs) is resolved here
// against the same locale/version-aware nav source the site tree uses; the
// rendering is the existing `DocCardGrid`. Titles, descriptions and hrefs
// always come from the canonical document, never from the reference, so a
// card can only point at a published page that exists.

import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { DocCardGrid, type DocCardItem } from "../nav-indexing/doc-card-grid.js";
import { isCanonicalDocSlug } from "./slug.js";

export { isCanonicalDocSlug };

/** Why a requested reference produced no card. */
export type DocCardDiagnosticReason = "invalid" | "duplicate" | "not-found" | "no-page";

export interface DocCardDiagnostic {
  /** The reference exactly as requested. */
  ref: unknown;
  reason: DocCardDiagnosticReason;
}

/** Minimal document shape read by {@link resolveDocCards}. */
export interface DocCardSourceDoc {
  slug: string;
  data: {
    slug?: string;
    title?: string;
    description?: string;
    category_no_page?: boolean;
  };
}

export interface ResolveDocCardsOptions {
  /** Published documents for the render locale/version (drafts already removed). */
  docs: readonly DocCardSourceDoc[];
  locale: string;
  /** Canonical route slug for a content entry slug. */
  toRouteSlug: (entrySlug: string) => string;
  /** Locale/base/trailing-slash-aware href for a route slug. */
  docsUrl: (slug: string, locale: string) => string;
  /** Active `/v/{version}` slug; hrefs use `versionedDocsUrl` when both are set. */
  currentVersion?: string;
  versionedDocsUrl?: (slug: string, versionSlug: string, lang: string) => string;
}

export interface ResolvedDocCards {
  items: DocCardItem[];
  diagnostics: DocCardDiagnostic[];
}

/**
 * Resolve ordered canonical slugs into card items. Order follows the request;
 * a repeated slug keeps its first occurrence. Invalid, unknown and no-page
 * references are omitted and reported — a link is never manufactured.
 */
export function resolveDocCards(
  refs: readonly unknown[],
  options: ResolveDocCardsOptions,
): ResolvedDocCards {
  const bySlug = new Map<string, DocCardSourceDoc>();
  for (const doc of options.docs) {
    const routeSlug = doc.data.slug ?? options.toRouteSlug(doc.slug);
    if (!bySlug.has(routeSlug)) bySlug.set(routeSlug, doc);
  }

  const items: DocCardItem[] = [];
  const diagnostics: DocCardDiagnostic[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    if (!isCanonicalDocSlug(ref)) {
      diagnostics.push({ ref, reason: "invalid" });
      continue;
    }
    if (seen.has(ref)) {
      diagnostics.push({ ref, reason: "duplicate" });
      continue;
    }
    seen.add(ref);
    const doc = bySlug.get(ref);
    if (!doc) {
      diagnostics.push({ ref, reason: "not-found" });
      continue;
    }
    if (doc.data.category_no_page === true) {
      diagnostics.push({ ref, reason: "no-page" });
      continue;
    }
    const href =
      options.currentVersion && options.versionedDocsUrl
        ? options.versionedDocsUrl(ref, options.currentVersion, options.locale)
        : options.docsUrl(ref, options.locale);
    const description = doc.data.description?.trim();
    items.push({
      href,
      title: doc.data.title ?? ref,
      ...(description ? { description } : {}),
    });
  }
  return { items, diagnostics };
}

/** Warn once per omitted reference. Duplicates are a documented no-op and stay silent. */
export function reportDocCardDiagnostics(
  diagnostics: readonly DocCardDiagnostic[],
  where: string,
): void {
  for (const { ref, reason } of diagnostics) {
    if (reason === "duplicate") continue;
    const detail =
      reason === "invalid"
        ? "is not a canonical document slug (e.g. \"getting-started/introduction\")"
        : reason === "not-found"
          ? "does not match a published document for this locale/version"
          : "is a category without a page";
    console.warn(`[zudo-doc] ${where}: ${JSON.stringify(ref)} ${detail} — omitted.`);
  }
}

export interface DocCardNavSource {
  navDocs: unknown[];
}

/** Injected dependencies for {@link createDocCardNavWrapper}. */
export interface DocCardNavDeps {
  defaultLocale: string;
  resolveNavSource: (
    lang: string,
    currentVersion: string | undefined,
    options?: { applyDefaultLocaleOnlyFilter?: boolean; keepUnlisted?: boolean },
  ) => DocCardNavSource;
  toRouteSlug: (entrySlug: string) => string;
  docsUrl: (slug: string, locale: string) => string;
  versionedDocsUrl?: (slug: string, versionSlug: string, lang: string) => string;
}

export interface DocCardNavProps {
  /** Ordered canonical document slugs, e.g. `["getting-started/introduction"]`. */
  docs: readonly string[];
  /** Accessible name of the card `<nav>`. @default "Selected documents" */
  ariaLabel?: string;
  /** Card column layout. @default "auto" (up to three columns by available width) */
  layout?: "auto" | "default";
  /** Active locale. Injected per page by the MDX component map. */
  lang?: string;
  /** Active version slug. Injected per page by the MDX component map. */
  currentVersion?: string;
}

/**
 * Create the `DocCardNav` server component bound to a nav source. It resolves
 * `docs` for the render locale/version and renders `DocCardGrid`; an empty
 * result renders nothing.
 */
export function createDocCardNavWrapper(
  deps: DocCardNavDeps,
): (props: DocCardNavProps) => JSX.Element | null {
  function DocCardNav({
    docs,
    ariaLabel = "Selected documents",
    layout = "auto",
    lang = deps.defaultLocale,
    currentVersion,
  }: DocCardNavProps): JSX.Element | null {
    const { navDocs } = deps.resolveNavSource(lang, currentVersion, {
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });
    const { items, diagnostics } = resolveDocCards(Array.isArray(docs) ? docs : [], {
      docs: navDocs as DocCardSourceDoc[],
      locale: lang,
      toRouteSlug: deps.toRouteSlug,
      docsUrl: deps.docsUrl,
      ...(currentVersion !== undefined ? { currentVersion } : {}),
      ...(deps.versionedDocsUrl ? { versionedDocsUrl: deps.versionedDocsUrl } : {}),
    });
    reportDocCardDiagnostics(diagnostics, "DocCardNav");
    return DocCardGrid({
      items,
      ariaLabel,
      ...(layout === "auto" ? { layout: "auto" as const } : {}),
    });
  }
  return DocCardNav;
}
