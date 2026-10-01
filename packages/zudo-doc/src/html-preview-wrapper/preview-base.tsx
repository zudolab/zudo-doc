/** @jsxRuntime automatic */
import {
  computed,
  getScope,
  signal,
  Show,
  type Child,
  type Ref,
} from "@takazudo/zfb/zudo-react";
import { HighlightedCode } from "./highlighted-code.js";
import { createPreviewAutoHeightController } from "./preview-auto-height.js";

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
 * The iframe is created in the reserved host during activation because zfb
 * 3.1.0 rejects iframe elements inside islands (#3361).
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
}: PreviewBaseProps): Child {
  const resolvedLabels = resolveLabels(labels);
  const sourceVisible = showSource ?? true;
  const viewportControlsVisible = showViewportControls ?? true;
  const viewports = viewportControlsVisible
    ? buildViewports(resolvedLabels)
    : DEFAULT_VIEWPORTS;
  const scope = getScope();
  const activeViewport = signal(2); // default: Full
  const codeOpen = signal(sourceVisible && (defaultOpen ?? false));
  const iframeHeight = signal(height ?? 200);
  const hostRef: Ref<HTMLDivElement> = { current: null };
  const autoHeightEnabled = (autoHeight ?? true) && height == null;
  let iframe: HTMLIFrameElement | null = null;
  let controller: ReturnType<typeof createPreviewAutoHeightController> | null = null;

  scope.onActivate(() => {
    const host = hostRef.current;
    if (!host) return;
    // srcdoc is assembled from author-trusted MDX/config. The iframe must be
    // imperative because zudo-react 3.1.0 rejects iframe inside islands (#3361).
    const frame = host.ownerDocument.createElement("iframe");
    iframe = frame;
    frame.className = "block w-full border-none bg-[#fff] rounded zd-preview-shadow";
    frame.setAttribute("title", title ?? resolvedLabels.preview);
    if (sandbox !== undefined) frame.setAttribute("sandbox", sandbox);
    frame.style.height = `${iframeHeight.value}px`;
    frame.srcdoc = srcdoc;
    if (autoHeightEnabled) {
      const nextController = createPreviewAutoHeightController({
        iframe: frame,
        syncDelay,
        getCurrentHeight: () => iframeHeight.value,
        setHeight: (nextHeight) => {
          iframeHeight.value = nextHeight;
        },
      });
      controller = nextController;
      const onLoad = () => nextController.handleLoad();
      frame.addEventListener("load", onLoad);
      host.append(frame);
      try {
        if (frame.contentDocument?.readyState === "complete") nextController.handleLoad();
      } catch {
        // Opaque documents may still emit a later load.
      }
      return () => {
        frame.removeEventListener("load", onLoad);
        nextController.destroy();
        controller = null;
        iframe = null;
        frame.remove();
      };
    }
    host.append(frame);
    return () => {
      iframe = null;
      frame.remove();
    };
  });

  scope.effect(() => {
    const nextHeight = iframeHeight.value;
    if (iframe) iframe.style.height = `${nextHeight}px`;
  });
  scope.effect(() => {
    activeViewport.value;
    if (autoHeightEnabled) controller?.schedule();
  });

  const containerWidth = computed(() =>
    viewportControlsVisible ? viewports[activeViewport.value]?.width ?? "100%" : "100%",
  );

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
                  type="button"
                  class={computed(() => `min-h-[44px] min-w-[44px] px-hsp-sm py-hsp-2xs text-caption border rounded-full cursor-pointer transition-[background,color,border-color] duration-150 leading-snug ${
                    i === activeViewport.value
                      ? "bg-accent text-bg border-accent hover:bg-accent-hover hover:border-accent-hover"
                      : "bg-transparent text-muted border-muted hover:bg-[color-mix(in_srgb,var(--color-surface)_80%,var(--color-fg)_20%)]"
                  }`)}
                  aria-pressed={computed(() => i === activeViewport.value)}
                  on:click={() => { activeViewport.value = i; }}
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
          style={computed(() => `width:${containerWidth.value}`)}
        >
          {/* Imperative iframe appears here on activation; see #3361. */}
          <div
            ref={hostRef}
            data-zd-html-preview-frame-host
            style={`min-height:${height ?? 200}px`}
          />
        </div>
      </div>

      {/* Code section */}
      {sourceVisible && (
        <div class="border-t border-muted">
          <button
            type="button"
            class="flex min-h-[44px] min-w-[44px] items-center w-full px-hsp-md py-hsp-sm text-caption font-medium text-muted bg-surface border-none cursor-pointer gap-hsp-xs hover:bg-[color-mix(in_srgb,var(--color-surface)_80%,var(--color-fg)_20%)]"
            on:click={() => { codeOpen.value = !codeOpen.value; }}
            aria-expanded={codeOpen}
          >
            <span
              class={computed(() => `text-caption transition-transform duration-200 ${codeOpen.value ? "rotate-90" : ""}`)}
              aria-hidden="true"
            >
              &#9654;
            </span>
            {computed(() => codeOpen.value ? resolvedLabels.hideCode : resolvedLabels.showCode)}
          </button>
          <Show when={codeOpen}>
            {() => <div>
              {codeBlocks.map((block, idx) => (
                <div
                  class={`overflow-x-auto ${idx > 0 ? "border-t border-muted" : ""}`}
                >
                  <span class="block px-hsp-md py-hsp-xs text-caption font-semibold text-muted bg-surface border-b border-muted uppercase tracking-wider">
                    {block.title}
                  </span>
                  <HighlightedCode code={block.code} language={block.language} />
                </div>
              ))}
            </div>}
          </Show>
        </div>
      )}
    </div>
  );
}
