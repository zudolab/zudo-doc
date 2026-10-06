"use client";

/** @jsxRuntime automatic */
// Mermaid-enlarge island — relocated from src/components/mermaid-enlarge.tsx
// (host showcase) into the package as part of Package-First Wave 3 (S3,
// epic #2344). Browser-only observation and delegated clicks are activated
// and disposed with the island scope.
//
// CSS blocks (.zd-mermaid-*) are shipped in @takazudo/zudo-doc/features.css
// (moved from src/styles/global.css by S3).

import { batch, computed, getScope, Show, signal } from "@takazudo/zfb/zudo-react";
import type { Ref } from "@takazudo/zfb/zudo-react";
import { AFTER_NAVIGATE_EVENT } from "../transitions/index.js";
import { modalDialog } from "../use-modal-dialog/index.js";
import {
  MERMAID_ENLARGE_DIALOG_CLASS,
  ENLARGE_DIALOG_STYLE,
} from "../island-types/index.js";

const CONTENT_SCOPE_SELECTOR = "main .zd-content";
const DIAGRAM_SVG_SELECTOR = ":scope > svg";
const INJECTED_BTN_SELECTOR = ":scope > .zd-enlarge-btn";
const BTN_INJECTED_ATTR = "data-mermaid-enlarge-ready";

const ZOOM_STEP = 1.25;
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ARROW_PAN_STEP = 40;

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function PanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M12 11V4.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M15 11V6a1.5 1.5 0 0 1 3 0v6.5a6.5 6.5 0 0 1-6.5 6.5h-1a6 6 0 0 1-4.6-2.16l-2.2-2.86a1.5 1.5 0 0 1 2.3-1.92L9 13" />
      <path d="M9 11V8a1.5 1.5 0 0 0-3 0v5" />
    </svg>
  );
}

interface OpenDiagram {
  container: HTMLElement;
  svgHtml: string;
}

interface DragState {
  dragging: boolean;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

export function MermaidEnlarge() {
  const scope = getScope();
  const open = signal<OpenDiagram | null>(null);
  const scale = signal(MIN_SCALE);
  const translate = signal({ x: 0, y: 0 });
  const panActive = signal(false);
  const innerRef: Ref<HTMLDivElement> = { current: null };
  const dragState: DragState = {
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  };

  const isOpen = computed(() => open.value !== null);
  const zoomed = computed(() => scale.value > MIN_SCALE);
  const atMax = computed(() => scale.value >= MAX_SCALE);
  const transformStyle = computed(() => ({
    transform: `translate(${translate.value.x}px, ${translate.value.y}px) scale(${scale.value})`,
    "transform-origin": "center",
  }));
  const svgHtml = computed(() => open.value?.svgHtml ?? "");
  const panActiveAttr = computed(() => panActive.value && zoomed.value ? "" : undefined);

  // Button injection follows client-rendered Mermaid diagrams. A real button
  // in the container is the guard because a Mermaid theme re-render can wipe
  // injected children while retaining the ready marker (#3132).
  scope.onActivate(() => {
    let active = true;
    let mutationObserver: MutationObserver | null = null;

    function injectButton(container: HTMLElement) {
      if (!active || container.querySelector(INJECTED_BTN_SELECTOR) !== null) return;
      const rendered =
        container.hasAttribute("data-mermaid-rendered") ||
        container.querySelector(DIAGRAM_SVG_SELECTOR) !== null;
      if (!rendered) return;

      container.setAttribute(BTN_INJECTED_ATTR, "");
      container.classList.add("zd-mermaid-enlargeable");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "zd-enlarge-btn";
      btn.setAttribute("aria-label", "Enlarge diagram");
      btn.innerHTML =
        '<svg viewBox="0 0 38.99 38.99" fill="currentColor" aria-hidden="true">' +
        '<polygon points="16.2 13.74 5.92 3.47 11.2 3.47 11.2 0 3.47 0 0 0 0 3.47 0 11.2 3.47 11.2 3.47 5.92 13.74 16.2 16.2 13.74" />' +
        '<polygon points="25.24 16.2 35.52 5.92 35.52 11.2 38.99 11.2 38.99 3.47 38.99 0 35.52 0 27.79 0 27.79 3.47 33.07 3.47 22.79 13.74 25.24 16.2" />' +
        '<polygon points="22.79 25.24 33.07 35.52 27.79 35.52 27.79 38.99 35.52 38.99 38.99 38.99 38.99 35.52 38.99 27.79 35.52 27.79 35.52 33.07 25.24 22.79 22.79 25.24" />' +
        '<polygon points="13.74 22.79 3.47 33.07 3.47 27.79 0 27.79 0 35.52 0 38.99 3.47 38.99 11.2 38.99 11.2 35.52 5.92 35.52 16.2 25.24 13.74 22.79" />' +
        "</svg>";
      container.appendChild(btn);
    }

    function scan() {
      if (!active) return;
      const content = document.querySelector<HTMLElement>(CONTENT_SCOPE_SELECTOR);
      content?.querySelectorAll<HTMLElement>(".mermaid").forEach(injectButton);
    }

    function startObserving() {
      const content = document.querySelector<HTMLElement>(CONTENT_SCOPE_SELECTOR);
      if (content) {
        mutationObserver = new MutationObserver(() => scan());
        mutationObserver.observe(content, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["data-mermaid-rendered"],
        });
      }
      scan();
    }

    function handleAfterNavigate() {
      mutationObserver?.disconnect();
      mutationObserver = null;
      startObserving();
    }

    startObserving();
    document.addEventListener(AFTER_NAVIGATE_EVENT, handleAfterNavigate);

    return () => {
      active = false;
      mutationObserver?.disconnect();
      document.removeEventListener(AFTER_NAVIGATE_EVENT, handleAfterNavigate);
    };
  });

  // Opening is delegated because Mermaid buttons are injected into authored
  // content after this island hydrates.
  scope.onActivate(() => {
    let active = true;
    function handleDocumentClick(event: Event) {
      if (!active || !(event.target instanceof Element)) return;
      const target = event.target;
      const container = target.closest<HTMLElement>(".zd-mermaid-enlargeable");
      if (!container || !target.closest(".zd-enlarge-btn")) return;
      const svg = container.querySelector(DIAGRAM_SVG_SELECTOR);
      if (!svg) return;
      batch(() => {
        scale.value = MIN_SCALE;
        translate.value = { x: 0, y: 0 };
        panActive.value = false;
        open.value = { container, svgHtml: svg.outerHTML };
      });
    }
    document.addEventListener("click", handleDocumentClick);
    return () => {
      active = false;
      document.removeEventListener("click", handleDocumentClick);
    };
  });

  // Keep the open clone aligned with Mermaid's live SVG. This effect owns the
  // observer for exactly one open diagram and disconnects it before switching
  // diagrams, closing, or disposing the island.
  scope.effect(() => {
    const current = open.value;
    if (!current) return;
    let active = true;
    const observer = new MutationObserver(() => {
      const latest = open.value;
      if (!active || scope.abortSignal.aborted || !latest || latest.container !== current.container) return;
      const svg = current.container.querySelector(DIAGRAM_SVG_SELECTOR);
      if (svg && svg.outerHTML !== latest.svgHtml) {
        open.value = { container: current.container, svgHtml: svg.outerHTML };
      }
    });
    observer.observe(current.container, { childList: true, subtree: true });
    return () => {
      active = false;
      observer.disconnect();
    };
  });

  function handleClose() {
    open.value = null;
  }

  function zoomIn() {
    scale.value = Math.min(MAX_SCALE, scale.value * ZOOM_STEP);
  }

  function zoomOut() {
    const next = Math.max(MIN_SCALE, scale.value / ZOOM_STEP);
    batch(() => {
      scale.value = next;
      if (next <= MIN_SCALE) {
        translate.value = { x: 0, y: 0 };
        panActive.value = false;
      }
    });
  }

  function togglePan() {
    panActive.value = !panActive.value;
  }

  function clampTranslate(x: number, y: number, currentScale: number) {
    const inner = innerRef.current;
    if (!inner) return { x, y };
    const rect = inner.getBoundingClientRect();
    const baseW = rect.width / currentScale;
    const baseH = rect.height / currentScale;
    const maxX = Math.max(0, (baseW * currentScale - baseW) / 2);
    const maxY = Math.max(0, (baseH * currentScale - baseH) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }

  function onPointerDown(event: Event) {
    const pointer = event as PointerEvent;
    if (!panActive.value || scale.value <= MIN_SCALE) return;
    dragState.dragging = true;
    dragState.startX = pointer.clientX;
    dragState.startY = pointer.clientY;
    dragState.originX = translate.value.x;
    dragState.originY = translate.value.y;
    (pointer.currentTarget as HTMLElement).setPointerCapture?.(pointer.pointerId);
  }

  function onPointerMove(event: Event) {
    const pointer = event as PointerEvent;
    if (!dragState.dragging) return;
    const nextX = dragState.originX + (pointer.clientX - dragState.startX);
    const nextY = dragState.originY + (pointer.clientY - dragState.startY);
    translate.value = clampTranslate(nextX, nextY, scale.value);
  }

  function onPointerUp(event: Event) {
    const pointer = event as PointerEvent;
    if (!dragState.dragging) return;
    dragState.dragging = false;
    (pointer.currentTarget as HTMLElement).releasePointerCapture?.(pointer.pointerId);
  }

  function onViewportKeyDown(event: Event) {
    const keyboard = event as KeyboardEvent;
    if (scale.value <= MIN_SCALE) return;
    let dx = 0;
    let dy = 0;
    if (keyboard.key === "ArrowLeft") dx = ARROW_PAN_STEP;
    else if (keyboard.key === "ArrowRight") dx = -ARROW_PAN_STEP;
    else if (keyboard.key === "ArrowUp") dy = ARROW_PAN_STEP;
    else if (keyboard.key === "ArrowDown") dy = -ARROW_PAN_STEP;
    else return;
    keyboard.preventDefault();
    translate.value = clampTranslate(
      translate.value.x + dx,
      translate.value.y + dy,
      scale.value,
    );
  }

  const { dialogRef, handleBackdropClick } = modalDialog(scope, {
    isOpen,
    onClose: handleClose,
    navigateEvent: AFTER_NAVIGATE_EVENT,
    backdropClickClose: true,
  });

  // The rawHtml assignment below is a Mermaid 11.15.0 renderer SVG clone;
  // Mermaid's default strict securityLevel remains configured.
  return (
    <dialog
      ref={dialogRef}
      on:click={handleBackdropClick}
      aria-label="Enlarged diagram"
      class={MERMAID_ENLARGE_DIALOG_CLASS}
      style={ENLARGE_DIALOG_STYLE}
    >
      <Show when={isOpen}>{() => (
        <>
          <div
            class="zd-mermaid-viewport"
            tabindex={0}
            on:pointerdown={onPointerDown}
            on:pointermove={onPointerMove}
            on:pointerup={onPointerUp}
            on:pointercancel={onPointerUp}
            on:keydown={onViewportKeyDown}
            data-pan-active={panActiveAttr}
          >
            <div
              ref={innerRef}
              class="zd-mermaid-transform"
              style={transformStyle}
              rawHtml={svgHtml}
            />
          </div>

          <div class="zd-mermaid-toolbar" role="toolbar" aria-label="Diagram zoom controls">
            <button
              type="button"
              class="zd-mermaid-tool-btn"
              aria-label="Zoom in"
              on:click={zoomIn}
              disabled={atMax}
            >
              <PlusIcon />
            </button>
            <button
              type="button"
              class="zd-mermaid-tool-btn"
              aria-label="Zoom out"
              on:click={zoomOut}
              disabled={computed(() => !zoomed.value)}
            >
              <MinusIcon />
            </button>
            <button
              type="button"
              class="zd-mermaid-tool-btn"
              aria-label="Toggle pan mode"
              aria-pressed={panActive}
              on:click={togglePan}
              disabled={computed(() => !zoomed.value)}
            >
              <PanIcon />
            </button>
          </div>

          <button
            type="button"
            on:click={() => dialogRef.current?.close()}
            class="zd-enlarge-dialog-close"
            aria-label="Close enlarged diagram"
          >
            <svg viewBox="0 0 161.03 161.03" fill="currentColor" aria-hidden="true">
              <polygon points="161.03 10.27 150.76 0 80.51 70.24 10.27 0 0 10.27 70.24 80.51 0 150.76 10.27 161.03 80.51 90.78 150.76 161.03 161.03 150.76 90.78 80.51 161.03 10.27" />
            </svg>
          </button>
        </>
      )}</Show>
    </dialog>
  );
}
MermaidEnlarge.displayName = "MermaidEnlarge";
