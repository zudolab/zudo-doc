/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { useEffect, useRef, useState } from "preact/hooks";
import type { VNode } from "preact";
import { HighlightedCode } from "./highlighted-code.js";
import {
  createPreviewAutoHeightController,
  type PreviewAutoHeightController,
} from "./preview-auto-height.js";

export interface CodeBlockData {
  language: string;
  title: string;
  code: string;
}

/**
 * Localized strings rendered by the HTML preview controls.
 *
 * Each public layer accepts a partial bag and resolves missing values against
 * the English defaults before rendering or forwarding the preview.
 */
export interface HtmlPreviewLabels {
  mobile: string;
  tablet: string;
  full: string;
  viewportSize: string;
  showCode: string;
  hideCode: string;
  preview: string;
}

export interface PreviewBaseProps {
  title?: string;
  height?: number;
  srcdoc: string;
  sandbox?: string;
  syncDelay: number;
  codeBlocks: CodeBlockData[];
  defaultOpen?: boolean;
  labels?: Partial<HtmlPreviewLabels>;
  showSource?: boolean;
  showViewportControls?: boolean;
  /** Internal opt-out for documents whose height derives from the iframe. */
  autoHeight?: boolean;
}

type Viewport = { label: string; width: string };

const DEFAULT_LABELS: HtmlPreviewLabels = {
  mobile: "Mobile",
  tablet: "Tablet",
  full: "Full",
  viewportSize: "Viewport size",
  showCode: "Show code",
  hideCode: "Hide code",
  preview: "Preview",
};

function resolveLabels(
  labels?: Partial<HtmlPreviewLabels>,
): HtmlPreviewLabels {
  return {
    mobile: labels?.mobile ?? DEFAULT_LABELS.mobile,
    tablet: labels?.tablet ?? DEFAULT_LABELS.tablet,
    full: labels?.full ?? DEFAULT_LABELS.full,
    viewportSize: labels?.viewportSize ?? DEFAULT_LABELS.viewportSize,
    showCode: labels?.showCode ?? DEFAULT_LABELS.showCode,
    hideCode: labels?.hideCode ?? DEFAULT_LABELS.hideCode,
    preview: labels?.preview ?? DEFAULT_LABELS.preview,
  };
}

function buildViewports(labels: HtmlPreviewLabels): Viewport[] {
  return [
    { label: labels.mobile, width: "320px" },
    { label: labels.tablet, width: "768px" },
    { label: labels.full, width: "100%" },
  ];
}

const DEFAULT_VIEWPORTS: Viewport[] = buildViewports(DEFAULT_LABELS);

/**
 * Interactive preview base: iframe viewport switcher + collapsible code
 * section.
 *
 * JSX port of src/components/html-preview/preview-base.tsx with
 * React → Preact hook imports and `className` → `class` attribute.
 */
export function PreviewBase({
  title,
  height,
  srcdoc,
  sandbox,
  syncDelay,
  codeBlocks,
  defaultOpen,
  labels,
  showSource,
  showViewportControls,
  autoHeight,
}: PreviewBaseProps): VNode {
  const resolvedLabels = resolveLabels(labels);
  const sourceVisible = showSource ?? true;
  const viewportControlsVisible = showViewportControls ?? true;
  const viewports = viewportControlsVisible
    ? buildViewports(resolvedLabels)
    : DEFAULT_VIEWPORTS;
  const [activeViewport, setActiveViewport] = useState(2); // default: Full
  const [codeOpen, setCodeOpen] = useState(
    sourceVisible && (defaultOpen ?? false),
  );
  const [iframeHeight, setIframeHeight] = useState(height ?? 200);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeHeightRef = useRef(iframeHeight);
  const autoHeightControllerRef = useRef<PreviewAutoHeightController | null>(
    null,
  );
  iframeHeightRef.current = iframeHeight;
  const autoHeightEnabled = (autoHeight ?? true) && height == null;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !autoHeightEnabled) return;
    const controller = createPreviewAutoHeightController({
      iframe,
      syncDelay,
      getCurrentHeight: () => iframeHeightRef.current,
      setHeight: (nextHeight) => {
        iframeHeightRef.current = nextHeight;
        setIframeHeight(nextHeight);
      },
    });
    autoHeightControllerRef.current = controller;
    const onLoad = () => controller.handleLoad();
    iframe.addEventListener("load", onLoad);
    try {
      if (iframe.contentDocument?.readyState === "complete") {
        controller.handleLoad();
      }
    } catch {
      // Opaque documents remain a safe no-op and may still emit a later load.
    }
    return () => {
      iframe.removeEventListener("load", onLoad);
      controller.destroy();
      if (autoHeightControllerRef.current === controller) {
        autoHeightControllerRef.current = null;
      }
    };
  }, [autoHeightEnabled, srcdoc, syncDelay]);

  // Re-measure height when viewport changes (content reflows)
  useEffect(() => {
    if (!autoHeightEnabled) return;
    autoHeightControllerRef.current?.schedule();
  }, [activeViewport, autoHeightEnabled]);

  // Without viewport controls there are no presets to select, but the
  // existing horizontal drag-resize affordance remains available.
  const containerWidth = viewportControlsVisible
    ? viewports[activeViewport]?.width ?? "100%"
    : "100%";

  return (
    <div class="border border-muted rounded-lg overflow-hidden my-vsp-md">
      {/* Title bar with viewport buttons */}
      {(viewportControlsVisible || title) && (
        <div class="flex items-center justify-between px-hsp-md py-hsp-sm bg-surface border-b border-muted gap-hsp-sm flex-wrap">
          {title && (
            <span class="text-caption font-semibold text-fg">{title}</span>
          )}
          {viewportControlsVisible && (
            <div
              class="flex gap-hsp-2xs"
              role="group"
              aria-label={resolvedLabels.viewportSize}
            >
              {viewports.map((vp, i) => (
                <button
                  key={vp.label}
                  type="button"
                  class={`min-h-[44px] min-w-[44px] px-hsp-sm py-hsp-2xs text-caption border rounded-full cursor-pointer transition-[background,color,border-color] duration-150 leading-snug ${
                    i === activeViewport
                      ? "bg-accent text-bg border-accent hover:bg-accent-hover hover:border-accent-hover"
                      : "bg-transparent text-muted border-muted hover:bg-[color-mix(in_srgb,var(--color-surface)_80%,var(--color-fg)_20%)]"
                  }`}
                  aria-pressed={i === activeViewport}
                  onClick={() => setActiveViewport(i)}
                >
                  {vp.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview area */}
      <div class="bg-surface p-hsp-lg">
        <div
          class="resize-x overflow-auto max-w-full mx-auto"
          style={{ width: containerWidth }}
        >
          {/* Intentional: white canvas regardless of site theme — matches standard browser context */}
          <iframe
            ref={iframeRef}
            class="block w-full border-none bg-[#fff] rounded shadow-[0_1px_3px_color-mix(in_srgb,var(--color-fg)_8%,transparent)]"
            srcDoc={srcdoc}
            sandbox={sandbox}
            style={{ height: height ?? iframeHeight }}
            title={title ?? resolvedLabels.preview}
          />
        </div>
      </div>

      {/* Code section */}
      {sourceVisible && (
        <div class="border-t border-muted">
          <button
            type="button"
            class="flex min-h-[44px] min-w-[44px] items-center w-full px-hsp-md py-hsp-sm text-caption font-medium text-muted bg-surface border-none cursor-pointer gap-hsp-xs hover:bg-[color-mix(in_srgb,var(--color-surface)_80%,var(--color-fg)_20%)]"
            onClick={() => setCodeOpen((v) => !v)}
            aria-expanded={codeOpen}
          >
            <span
              class={`text-caption transition-transform duration-200 ${codeOpen ? "rotate-90" : ""}`}
              aria-hidden="true"
            >
              &#9654;
            </span>
            {codeOpen ? resolvedLabels.hideCode : resolvedLabels.showCode}
          </button>
          {codeOpen && (
            <div>
              {codeBlocks.map((block, idx) => (
                <div
                  key={block.title}
                  class={`overflow-x-auto ${idx > 0 ? "border-t border-muted" : ""}`}
                >
                  <span class="block px-hsp-md py-hsp-xs text-caption font-semibold text-muted bg-surface border-b border-muted uppercase tracking-wider">
                    {block.title}
                  </span>
                  <HighlightedCode code={block.code} language={block.language} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
