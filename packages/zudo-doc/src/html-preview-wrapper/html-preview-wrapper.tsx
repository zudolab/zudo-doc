"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { VNode } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
// `@takazudo/zfb` is provided by the consumer at integration time;
// types come from the package-level shim at `../_zfb-shim.d.ts`.
import { Island } from "@takazudo/zfb";

import { HtmlPreview, type HtmlPreviewLabels } from "./html-preview.js";

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
   * Controls when the preview subtree is rendered.
   *
   * `"eager"` (and omission) preserves the server-rendered iframe and
   * hydrates it when visible. `"visible"` emits only an inert height
   * reservation during SSR and renders the preview on the client through
   * zfb's skip-SSR island path.
   *
   * This is a component lifecycle policy and is not forwarded as the native
   * iframe `loading` attribute.
   *
   * @default "eager"
   */
  loading?: "eager" | "visible";

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
  /**
   * Language tag for the generated preview document. Any nonblank tag is
   * forwarded as-is; omission or a blank value falls back to `"en"` in
   * `<HtmlPreview>`. Bound consumers should pass their active route locale.
   *
   * @default "en"
   */
  lang?: string;
  /** Fixed iframe height in pixels. Auto-sizes when omitted. */
  height?: number;
  /** When true, the code section is expanded by default. */
  defaultOpen?: boolean;
  /** Localized labels for viewport, source, and iframe controls. */
  labels?: Partial<HtmlPreviewLabels>;
  /** Whether the source toggle and code panel are rendered. @default true */
  showSource?: boolean;
  /** Whether the viewport preset controls are rendered. @default true */
  showViewportControls?: boolean;
  /**
   * Forwarded to `<HtmlPreview>`. When true, makes the preview document's
   * `html`/`body` stretch to 100% height. Interacts with auto-height — pair
   * with an explicit `height` prop. See `HtmlPreviewProps.fullHeight` for
   * details.
   *
   * @default false
   */
  fullHeight?: boolean;

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

  /**
   * External stylesheet URLs, forwarded to `<HtmlPreview>` as-is. Per-usage
   * only (v1) — deliberately NOT part of `HtmlPreviewGlobalConfig`, so there
   * is no site-wide equivalent to merge. Loaded client-side at view time
   * (a network dependency at render), not build-bundled. See
   * `HtmlPreviewProps.externalStyles` for details.
   */
  externalStyles?: string[];
  /**
   * External script URLs, forwarded to `<HtmlPreview>` as-is. Presence
   * flips the sandbox/`syncDelay` derivation to script-allowing exactly
   * like `js`. Per-usage only (v1) — deliberately NOT part of
   * `HtmlPreviewGlobalConfig`. See `HtmlPreviewProps.externalScripts` for
   * details.
   */
  externalScripts?: string[];
  /**
   * Forwarded to `<HtmlPreview>`. When false, skips the injected preflight
   * reset — useful when a framework loaded via `externalStyles`/
   * `externalScripts` ships its own reset.
   *
   * @default true
   */
  preflight?: boolean;
  /**
   * Forwarded to `<HtmlPreview>`. When true, surfaces `externalStyles`/
   * `externalScripts` as literal lines at the top of the "HTML" code panel.
   *
   * @default false
   */
  showResources?: boolean;
}

type HtmlPreviewWrapperInnerProps = Omit<
  HtmlPreviewWrapperProps,
  "loading"
>;

// zfb 2.14.x intentionally mounts skip-SSR (`mode="render"`) islands
// immediately, regardless of their `data-when` value. This private serialized
// flag lets the bare hydration target preserve the public marker identity while
// applying the visible gate locally. It is deliberately absent from every
// exported prop type and stripped before HtmlPreview is instantiated.
const VISIBLE_MOUNT_PROP = "__zudoDocVisibleMount";
type HtmlPreviewWrapperInnerRuntimeProps =
  HtmlPreviewWrapperInnerProps & {
    [VISIBLE_MOUNT_PROP]?: true;
  };

function reservationHeight(height: number | undefined): number {
  return height != null && height > 0 ? height : 200;
}

function HtmlPreviewReservation({
  height,
  reservationRef,
}: {
  height: number | undefined;
  reservationRef?: { current: HTMLDivElement | null };
}): VNode {
  return (
    <div
      ref={reservationRef}
      aria-hidden="true"
      data-zd-html-preview-reservation
      style={{ height: reservationHeight(height) }}
    />
  );
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
  props: HtmlPreviewWrapperInnerProps,
): VNode {
  const runtimeProps = props as HtmlPreviewWrapperInnerRuntimeProps;
  const deferUntilVisible = runtimeProps[VISIBLE_MOUNT_PROP] === true;
  const reservationRef = useRef<HTMLDivElement>(null);
  const [shouldRenderPreview, setShouldRenderPreview] = useState(
    !deferUntilVisible ||
      typeof globalThis.IntersectionObserver !== "function",
  );

  useEffect(() => {
    if (shouldRenderPreview) return;
    if (!deferUntilVisible) {
      setShouldRenderPreview(true);
      return;
    }

    const target = reservationRef.current;
    const Observer = globalThis.IntersectionObserver;
    if (!target || typeof Observer !== "function") {
      // Match zfb's visible-hydration policy: unsupported observer APIs fail
      // open so the preview remains functional in old browsers/test hosts.
      setShouldRenderPreview(true);
      return;
    }

    let fired = false;
    const observer = new Observer(
      (entries) => {
        if (fired || !entries.some((entry) => entry.isIntersecting)) return;
        fired = true;
        observer.disconnect();
        setShouldRenderPreview(true);
      },
      { threshold: 0 },
    );
    observer.observe(target);

    return () => {
      fired = true;
      observer.disconnect();
    };
  }, [deferUntilVisible, shouldRenderPreview]);

  const {
    [VISIBLE_MOUNT_PROP]: _visibleMount,
    globalConfig,
    html,
    css,
    head,
    js,
    title,
    lang,
    height,
    defaultOpen,
    labels,
    showSource,
    showViewportControls,
    fullHeight,
    sandbox,
    externalStyles,
    externalScripts,
    preflight,
    showResources,
  } = runtimeProps;

  if (!shouldRenderPreview) {
    return (
      <HtmlPreviewReservation
        height={height}
        reservationRef={reservationRef}
      />
    );
  }

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
      lang={lang}
      height={height}
      defaultOpen={defaultOpen}
      labels={labels}
      showSource={showSource}
      showViewportControls={showViewportControls}
      fullHeight={fullHeight}
      sandbox={sandbox}
      componentCss={css}
      componentHead={head}
      componentJs={js}
      externalStyles={externalStyles}
      externalScripts={externalScripts}
      preflight={preflight}
      showResources={showResources}
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
 * Eager mode wraps the bare `HtmlPreviewWrapperInner` in
 * `<Island when="visible">`, mirroring the legacy `client:visible` hydration
 * timing while preserving the complete server-rendered preview. Visible mode
 * uses zfb's skip-SSR fallback path: static output contains only an inert
 * nonzero reservation, while the real serializable inner props remain on the
 * island marker for the client mount. zfb intentionally mounts skip-SSR
 * islands immediately, so the bare inner target keeps that reservation in
 * place and applies its own one-shot IntersectionObserver gate before it
 * instantiates the preview subtree; missing observer support fails open.
 *
 * The public export name and signature are unchanged from before the
 * zudolab/zudo-doc#1925 fix, so existing consumers that register
 * `HtmlPreview: HtmlPreviewWrapper` keep working (and now hydrate correctly)
 * with no call-site change.
 */
export function HtmlPreviewWrapper(
  props: HtmlPreviewWrapperProps,
): VNode {
  const { loading = "eager", ...innerProps } = props;

  if (loading === "visible") {
    const visibleInnerProps = {
      ...innerProps,
      [VISIBLE_MOUNT_PROP]: true,
    } as HtmlPreviewWrapperInnerProps;

    const rendered = Island({
      when: "visible",
      ssrFallback: <HtmlPreviewReservation height={innerProps.height} />,
      children: <HtmlPreviewWrapperInner {...visibleInnerProps} />,
    });
    return rendered as unknown as VNode;
  }

  const rendered = Island({
    when: "visible",
    children: <HtmlPreviewWrapperInner {...innerProps} />,
  });
  return rendered as unknown as VNode;
}
