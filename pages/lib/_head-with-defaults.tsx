/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// og:title / og:description head injection wrapper for the zfb doc pages.
//
// Why this wrapper exists: Astro's baseline doc-layout.astro synthesizes
// og:title and og:description from frontmatter title/description and emits
// them automatically on every page. The v2 <DocLayout> shell exposes a
// `head` slot (ComponentChildren injected after the baseline charset /
// viewport / title / description meta) but intentionally does NOT
// synthesize og:* tags — that is the host's responsibility. Without this
// wrapper all 121 content-loss routes built by the zfb host pages are
// missing og:title and og:description, failing the migration-check parity
// test. This wrapper plugs the gap by forwarding the per-page title and
// description through <OgTags> so every zfb host page emits the same
// og:title (always) and og:description (when set) that the Astro original
// produced.

import type { JSX } from "preact";
import { OgTags } from "@zudo-doc/zudo-doc-v2/head";

export interface HeadWithDefaultsProps {
  /** Page title forwarded to og:title. Required. */
  title: string;
  /** Optional page description forwarded to og:description. */
  description?: string;
}

/**
 * Default-bearing host wrapper that injects og:title and og:description
 * into the v2 layout's `head` slot.
 *
 * Pure SSR — no state, no client-only imports. Intended for use as:
 *   head={<HeadWithDefaults title={title} description={description} />}
 * on every DocLayoutWithDefaults call site in the host pages.
 */
export function HeadWithDefaults({
  title,
  description,
}: HeadWithDefaultsProps): JSX.Element {
  return <OgTags title={title} description={description} />;
}
