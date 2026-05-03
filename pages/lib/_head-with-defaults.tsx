/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// og:title / og:description / color-scheme head injection for the zfb doc pages.
//
// Why this wrapper exists: Astro's baseline doc-layout.astro synthesized
// og:* meta from frontmatter title/description AND mounted the
// `<color-scheme-provider>` Astro component (deleted in commit a4d9956 when
// `src/**/*.astro` was retired). The v2 `<DocLayout>` shell exposes a
// `head` slot but intentionally does NOT emit either — that is the host's
// responsibility.
//
// Without OgTags the migration-check parity harness fails on missing
// og:title / og:description. Without ColorSchemeProvider the runtime
// `:root { --zd-* }` palette is missing, so every component that resolves
// a color via `--zd-*` (search match-keyword highlight, image-overlay,
// etc.) falls back to UA defaults — and the smoke-search "matched
// keywords" regression guard at e2e/smoke-search.spec.ts:167 fires
// because `getComputedStyle(root).getPropertyValue("--zd-matched-keyword-bg")`
// returns "" instead of the resolved palette token.
//
// (#1355 wave 13 — restoring the Astro-era ColorSchemeProvider mount that
// was orphaned during the .astro retirement.)

import type { JSX } from "preact";
import { OgTags } from "@zudo-doc/zudo-doc-v2/head";
import { ColorSchemeProvider } from "@zudo-doc/zudo-doc-v2/theme";
import { composeMetaTitle } from "./_compose-meta-title";

export interface HeadWithDefaultsProps {
  /** Page title forwarded to og:title. Required. */
  title: string;
  /** Optional page description forwarded to og:description. */
  description?: string;
}

/**
 * Default-bearing host wrapper that injects og:title / og:description and
 * the ColorSchemeProvider (`:root { --zd-* }` palette + theme bootstrap)
 * into the v2 layout's `head` slot.
 *
 * og:title is run through composeMetaTitle so it matches the
 * "<title> | <siteName>" shape emitted by the host's <title> element
 * (the legacy Astro layout produced both shapes; the zfb host has to
 * compose them itself).
 *
 * Pure SSR — no state, no client-only imports. Intended for use as:
 *   head={<HeadWithDefaults title={title} description={description} />}
 * on every DocLayoutWithDefaults call site in the host pages.
 */
export function HeadWithDefaults({
  title,
  description,
}: HeadWithDefaultsProps): JSX.Element {
  return (
    <>
      <OgTags title={composeMetaTitle(title)} description={description} />
      <ColorSchemeProvider />
    </>
  );
}
