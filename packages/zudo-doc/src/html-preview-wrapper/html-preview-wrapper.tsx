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

  /**
   * iframe `sandbox` attribute value, forwarded to `<HtmlPreview>`. Omit to
   * use the computed default (`allow-scripts allow-same-origin` when scripts
   * are present, `allow-same-origin` otherwise).
   *
   * ⚠️ The default voids iframe sandboxing (preview scripts can reach the
   * parent origin) and is only safe for **author-trusted** content.
   * Downstream consumers rendering semi-trusted HTML should pass a stricter
   * value (e.g. `"allow-scripts"` or `""`) — but note that dropping
   * `allow-same-origin` disables auto-height, so pair it with a fixed
   * `height`. See `HtmlPreviewProps.sandbox` for details.
   */
  sandbox?: string;
}

/**
 * Bare HTML preview body — the actual island **hydration target**.
 *
 * Merges global (`settings.htmlPreview`) config with per-usage props and
 * forwards everything to `<HtmlPreview>`. Renders the preview tree
 * **directly**: it does NOT wrap itself in `<Island>`. `HtmlPreviewWrapper`
 * below applies the `<Island when="visible">` wrapper around it.
 *
 * ## Island invariant (read before touching the displayName / Island wiring)
 *
 * The hydration-target export's NAME must equal its `displayName` (which
 * becomes the `data-zfb-island="…"` marker), AND that export must NOT itself
 * render an `<Island>`. The zfb scanner resolves the client hydration
 * component by marker-name → export-name lookup; if the resolved export
 * re-wraps in `Island()`, the client re-emits a second `data-zfb-island`
 * wrapper and Preact reuses the SSR'd children one level off — re-parenting
 * the preview + code sections inside the flex title bar (the broken
 * side-by-side layout). This is the same class of bug fixed for
 * Toc / MobileToc / Sidebar in zudolab/zudo-doc#1355 and was the original
 * defect here (zudolab/zudo-doc#1925, an Astro→zfb migration regression):
 * the inner bare component carried the *outer* wrapper's name
 * (`displayName = "HtmlPreviewWrapper"`) and was not exported, so the marker
 * resolved to the exported self-wrapping `HtmlPreviewWrapper` and the client
 * double-wrapped. Fix: the bare component carries its OWN name
 * (`HtmlPreviewWrapperInner`) and is exported, so the marker resolves to
 * THIS bare component and the bundle hydrates it in-place.
 */
export function HtmlPreviewWrapperInner(
  props: HtmlPreviewWrapperProps,
): VNode {
  const {
    globalConfig,
    html,
    css,
    head,
    js,
    title,
    height,
    defaultOpen,
    sandbox,
  } = props;

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
      sandbox={sandbox}
      componentCss={css}
      componentHead={head}
      componentJs={js}
    />
  );
}
// Pin the marker name to "HtmlPreviewWrapperInner" (its own name) so the SSR
// `<Island>` marker resolves to THIS bare export even after esbuild
// minification renames the function. Per the invariant above, it must equal
// the export name and must not match the self-wrapping `HtmlPreviewWrapper`.
HtmlPreviewWrapperInner.displayName = "HtmlPreviewWrapperInner";

/**
 * HTML preview wrapper component — the public MDX-registered binding
 * (`HtmlPreview: HtmlPreviewWrapper`).
 *
 * Wraps the bare `HtmlPreviewWrapperInner` in `<Island when="visible">`,
 * mirroring the legacy `client:visible` hydration timing — the iframe is
 * heavy and not on the critical path, so hydration is deferred until the
 * preview enters the viewport. The SSG output emits
 * `data-zfb-island="HtmlPreviewWrapperInner"` around the bare tree, and the
 * client bundle hydrates `HtmlPreviewWrapperInner` against it in-place.
 *
 * The public export name and signature are unchanged from before the
 * zudolab/zudo-doc#1925 fix, so existing consumers that register
 * `HtmlPreview: HtmlPreviewWrapper` keep working (and now hydrate correctly)
 * with no call-site change.
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
