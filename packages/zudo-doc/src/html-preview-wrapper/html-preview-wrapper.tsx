"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { VNode } from "preact";
// `@takazudo/zfb` is provided by the consumer at integration time;
// types come from the package-level shim at `../_zfb-shim.d.ts`.
import { Island } from "@takazudo/zfb";

import { HtmlPreview } from "./html-preview.js";

/**
 * Global HTML preview configuration. Mirrors the `settings.htmlPreview`
 * shape from the host project so callers can pass the resolved config
 * object directly.
 */
export interface HtmlPreviewGlobalConfig {
  /** CSS appended to every preview iframe (e.g. global component library styles). */
  css?: string;
  /** HTML injected into the `<head>` of every preview iframe. */
  head?: string;
  /** JavaScript appended to every preview iframe's `<body>`. */
  js?: string;
}

export interface HtmlPreviewWrapperProps {
  /**
   * Site-wide HTML preview configuration (resolved from
   * `settings.htmlPreview` by the caller). When provided, its
   * `head`, `css`, and `js` are prepended to the per-usage values so
   * that global styles/scripts apply to every preview.
   *
   * The legacy html-preview-wrapper read this directly from `settings`;
   * v2 accepts it as a prop so the component has no upward dependency
   * on the project settings module.
   */
  globalConfig?: HtmlPreviewGlobalConfig | null;

  /** HTML body content to display in the iframe. */
  html: string;
  /** Per-usage CSS injected after the global CSS. */
  css?: string;
  /** Per-usage `<head>` content injected after the global head. */
  head?: string;
  /** Per-usage JavaScript injected after the global JS. */
  js?: string;

  /** Optional title displayed in the preview title bar. */
  title?: string;
  /** Fixed iframe height in pixels. Auto-sizes when omitted. */
  height?: number;
  /** When true, the code section is expanded by default. */
  defaultOpen?: boolean;
}

/**
 * Bare HTML preview island component — the hydration target.
 *
 * Merges global (`settings.htmlPreview`) config with per-usage props and
 * forwards everything to `<HtmlPreview>`. Renders the preview tree
 * **directly**: it does NOT wrap itself in `<Island>`. The caller is
 * responsible for applying the `<Island when="visible">` wrapper — use the
 * `HtmlPreviewIsland` export below (which MDX registers as `HtmlPreview`).
 *
 * Why the wrapper lives at the call site, not here:
 *
 * Pre-this-fix, `HtmlPreviewWrapper` called `Island(...)` internally and an
 * inner component carried `displayName = "HtmlPreviewWrapper"`. The zfb
 * island scanner picked the exported wrapper as the hydration target, so on
 * the client `mountIslands` ran `hydrate(<HtmlPreviewWrapper/>, dataIslandDiv)`
 * where the vnode itself rendered to *another*
 * `<div data-zfb-island="HtmlPreviewWrapper">…</div>`. Preact then reused the
 * SSR'd marker's children one level off, re-parenting the preview + code
 * sections inside the title bar instead of in-place hydrating them — the same
 * class of bug fixed for Toc / MobileToc / Sidebar in zudolab/zudo-doc#1355
 * (see the leading comment in `../toc/toc.tsx`). Moving the `<Island>` wrapper
 * to the call site lets the bundle hydrate this bare component against the
 * existing DOM in-place. This was an Astro→zfb migration regression: the same
 * component rendered correctly under Astro/React, whose hydration tolerated
 * the double-wrap.
 */
export function HtmlPreviewWrapper(
  props: HtmlPreviewWrapperProps,
): VNode {
  const { globalConfig, html, css, head, js, title, height, defaultOpen } =
    props;

  const mergedHead =
    [globalConfig?.head, head].filter(Boolean).join("\n") || undefined;
  const mergedCss =
    [globalConfig?.css, css].filter(Boolean).join("\n") || undefined;
  const mergedJs =
    [globalConfig?.js, js].filter(Boolean).join("\n") || undefined;

  return (
    <HtmlPreview
      html={html}
      css={mergedCss}
      head={mergedHead}
      js={mergedJs}
      title={title}
      height={height}
      defaultOpen={defaultOpen}
      componentCss={css}
      componentHead={head}
      componentJs={js}
    />
  );
}
// Pin the marker name to "HtmlPreviewWrapper" explicitly so the SSR `<Island>`
// wrapper resolves a stable component identity even after esbuild minification
// renames the function — see Toc/MobileToc for rationale.
HtmlPreviewWrapper.displayName = "HtmlPreviewWrapper";

/**
 * Call-site Island wrapper for `<HtmlPreviewWrapper>`.
 *
 * Emits the `data-zfb-island="HtmlPreviewWrapper"` SSG marker and defers
 * hydration until the preview scrolls into view (`when="visible"`, mirroring
 * the legacy `client:visible` timing — the iframe is heavy and off the
 * critical path). MDX registers THIS component as `HtmlPreview` so the zfb
 * island bundle hydrates the bare `HtmlPreviewWrapper` against the SSR'd
 * marker in-place. Keeping the wrapper here (not inside `HtmlPreviewWrapper`)
 * is what prevents the double-wrap hydration mis-nest described above.
 */
export function HtmlPreviewIsland(
  props: HtmlPreviewWrapperProps,
): VNode {
  return Island({
    when: "visible",
    children: <HtmlPreviewWrapper {...props} />,
  }) as unknown as VNode;
}
