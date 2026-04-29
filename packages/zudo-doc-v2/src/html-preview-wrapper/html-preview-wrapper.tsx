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
   * The legacy `html-preview-wrapper.astro` read this directly from
   * `settings`; v2 accepts it as a prop so the component has no
   * upward dependency on the project settings module.
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
 * Inner wrapper body — the data-prep that merges global + per-usage
 * config and forwards to `<HtmlPreview>`. The exported
 * `HtmlPreviewWrapper` wraps this in `<Island>` so SSG-rendered HTML
 * emits `data-zfb-island="HtmlPreviewWrapper"` for the hydration
 * runtime.
 */
function HtmlPreviewWrapperInner(
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
// Pin the marker name to "HtmlPreviewWrapper" — see Toc/MobileToc for
// rationale.
HtmlPreviewWrapperInner.displayName = "HtmlPreviewWrapper";

/**
 * HTML preview wrapper — JSX port of
 * `src/components/html-preview-wrapper.astro`.
 *
 * The legacy Astro wrapper merged `settings.htmlPreview` (global config)
 * with per-usage props and forwarded everything to `<HtmlPreview
 * client:visible />`. v2 collapses the merge into the inner shell and
 * wraps it in `<Island when="visible">` here, mirroring the legacy
 * `client:visible` hydration timing — the iframe is heavy and not on
 * the critical path, so we defer hydration until the preview enters
 * the viewport.
 */
export function HtmlPreviewWrapper(
  props: HtmlPreviewWrapperProps,
): VNode {
  const rendered = Island({
    when: "visible",
    children: <HtmlPreviewWrapperInner {...props} />,
  });
  return rendered as unknown as VNode;
}
