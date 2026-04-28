// Phase-A local SSR-skip island stubs — local counterparts of the framework
// wrappers in packages/zudo-doc-v2/src/ssr-skip/. Kept in src/ to avoid
// cross-package import complexity during Phase A scaffolding.
//
// Each wrapper emits a placeholder `<div>` with zfb marker attributes so
// the zfb hydration runtime can find and replace it on the client. The
// marker contract (`data-zfb-island-skip-ssr`, `data-when`,
// `data-zfb-island-props`) is identical to the package versions.
//
// Usage: import from "@/components/ssr-islands" in .astro files that need
// these wrappers instead of `client:only="preact"` directives.

import { h } from "preact";
import type { ComponentChildren, VNode } from "preact";

type IslandWhen = "load" | "idle" | "visible" | "media";

interface SsrSkipBaseProps {
  when?: IslandWhen;
  ssrFallback?: ComponentChildren;
}

/** Internal helper: emit the placeholder `<div>` with zfb marker attrs. */
function ssrSkipPlaceholder(
  name: string,
  when: IslandWhen,
  fallback: ComponentChildren,
  props: Record<string, unknown>,
): VNode {
  const attrs: Record<string, unknown> = {
    "data-zfb-island-skip-ssr": name,
    "data-when": when,
  };
  const serialisable = Object.fromEntries(
    Object.entries(props).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(serialisable).length > 0) {
    try {
      attrs["data-zfb-island-props"] = JSON.stringify(serialisable);
    } catch {
      // drop non-serialisable props rather than crash SSR
    }
  }
  return h("div", attrs, fallback ?? null);
}

// ─── AiChatModal ─────────────────────────────────────────────────────────────

export interface AiChatModalIslandProps extends SsrSkipBaseProps {
  /** Base path forwarded to the real component on hydration. */
  basePath: string;
}

/**
 * SSR-skip wrapper for the AI chat modal.
 * Drop-in replacement for `<AiChatModal basePath={...} client:load />`.
 */
export function AiChatModalIsland({
  when = "load",
  ssrFallback = null,
  basePath,
}: AiChatModalIslandProps): VNode {
  return ssrSkipPlaceholder("AiChatModal", when, ssrFallback, { basePath });
}

// ─── ImageEnlarge ────────────────────────────────────────────────────────────

export type ImageEnlargeIslandProps = SsrSkipBaseProps;

/**
 * SSR-skip wrapper for the image-enlarge dialog.
 * Drop-in replacement for `<ImageEnlarge client:idle />`.
 */
export function ImageEnlargeIsland(
  props: ImageEnlargeIslandProps = {},
): VNode {
  const { when = "idle", ssrFallback = null } = props;
  return ssrSkipPlaceholder("ImageEnlarge", when, ssrFallback, {});
}

// ─── DesignTokenTweakPanel ───────────────────────────────────────────────────

export type DesignTokenTweakPanelIslandProps = SsrSkipBaseProps;

/**
 * SSR-skip wrapper for the design-token tweak panel.
 * Drop-in replacement for `<DesignTokenTweakPanel client:only="preact" />`.
 */
export function DesignTokenTweakPanelIsland(
  props: DesignTokenTweakPanelIslandProps = {},
): VNode {
  const { when = "load", ssrFallback = null } = props;
  return ssrSkipPlaceholder("DesignTokenTweakPanel", when, ssrFallback, {});
}

// ─── MockInit ────────────────────────────────────────────────────────────────

export type MockInitIslandProps = SsrSkipBaseProps;

/**
 * SSR-skip wrapper for the dev-only MSW mock initialiser.
 * Drop-in replacement for `<MockInit client:only="preact" />`.
 */
export function MockInitIsland(props: MockInitIslandProps = {}): VNode {
  const { when = "idle", ssrFallback = null } = props;
  return ssrSkipPlaceholder("MockInit", when, ssrFallback, {});
}

// ─── DocHistory ──────────────────────────────────────────────────────────────

export interface DocHistoryIslandProps extends SsrSkipBaseProps {
  /** Page slug for the history JSON fetch path. */
  slug: string;
  /** Locale code (omit for default locale). */
  locale?: string;
  /** Site base path. */
  basePath?: string;
}

/**
 * SSR-skip wrapper for the doc-history dialog.
 * Drop-in replacement for `<DocHistory slug={...} client:idle />`.
 */
export function DocHistoryIsland({
  when = "idle",
  ssrFallback = null,
  slug,
  locale,
  basePath,
}: DocHistoryIslandProps): VNode {
  return ssrSkipPlaceholder("DocHistory", when, ssrFallback, {
    slug,
    locale,
    basePath,
  });
}
