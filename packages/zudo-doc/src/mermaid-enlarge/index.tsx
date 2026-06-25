"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// Mermaid-enlarge island — relocated from src/components/mermaid-enlarge.tsx
// (host showcase) into the package as part of Package-First Wave 3 (S3,
// epic #2344). Uses shared hook + constants from S1a foundation:
//   - useModalDialog  from @takazudo/zudo-doc/use-modal-dialog
//   - MERMAID_ENLARGE_DIALOG_CLASS / ENLARGE_DIALOG_STYLE from @takazudo/zudo-doc/island-types
//
// CSS blocks (.zd-mermaid-*) are shipped in @takazudo/zudo-doc/features.css
// (moved from src/styles/global.css by S3).

import { useState, useEffect, useRef, useCallback } from "preact/compat";
import { AFTER_NAVIGATE_EVENT } from "../transitions/index.js";
import { useModalDialog } from "../use-modal-dialog/index.js";
import {
  MERMAID_ENLARGE_DIALOG_CLASS,
  ENLARGE_DIALOG_STYLE,
} from "../island-types/index.js";

const CONTENT_SCOPE_SELECTOR = "main .zd-content";
const DIAGRAM_SVG_SELECTOR = ":scope > svg";
const BTN_INJECTED_ATTR = "data-mermaid-enlarge-ready";

const ZOOM_STEP = 1.25;
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ARROW_PAN_STEP = 40;

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function PanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" focusable="false">
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

export function MermaidEnlarge() {
  const [open, setOpen] = useState<OpenDiagram | null>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [panActive, setPanActive] = useState(false);

  const innerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>({ dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  // Button injection effect
  useEffect(() => {
    let mutationObserver: MutationObserver | null = null;

    function injectButton(container: HTMLElement) {
      if (container.hasAttribute(BTN_INJECTED_ATTR)) return;
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
        '<svg viewBox="0 0 38.99 38.99" fill="currentColor" focusable="false" aria-hidden="true">' +
        '<polygon points="16.2 13.74 5.92 3.47 11.2 3.47 11.2 0 3.47 0 0 0 0 3.47 0 11.2 3.47 11.2 3.47 5.92 13.74 16.2 16.2 13.74" />' +
        '<polygon points="25.24 16.2 35.52 5.92 35.52 11.2 38.99 11.2 38.99 3.47 38.99 0 35.52 0 27.79 0 27.79 3.47 33.07 3.47 22.79 13.74 25.24 16.2" />' +
        '<polygon points="22.79 25.24 33.07 35.52 27.79 35.52 27.79 38.99 35.52 38.99 38.99 38.99 38.99 35.52 38.99 27.79 35.52 27.79 35.52 33.07 25.24 22.79 22.79 25.24" />' +
        '<polygon points="13.74 22.79 3.47 33.07 3.47 27.79 0 27.79 0 35.52 0 38.99 3.47 38.99 11.2 38.99 11.2 35.52 5.92 35.52 16.2 25.24 13.74 22.79" />' +
        "</svg>";
      container.appendChild(btn);
    }

    function scan() {
      const scope = document.querySelector(CONTENT_SCOPE_SELECTOR);
      if (!scope) return;
      scope.querySelectorAll<HTMLElement>(".mermaid").forEach((el) => injectButton(el));
    }

    function startObserving() {
      const scope = document.querySelector(CONTENT_SCOPE_SELECTOR);
      if (scope) {
        mutationObserver = new MutationObserver(() => scan());
        mutationObserver.observe(scope, {
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
      mutationObserver?.disconnect();
      document.removeEventListener(AFTER_NAVIGATE_EVENT, handleAfterNavigate);
    };
  }, []);

  // Delegated open handler
  useEffect(() => {
    function handleDocumentClick(e: MouseEvent) {
      const target = e.target as Element;
      const container = target.closest(".zd-mermaid-enlargeable") as HTMLElement | null;
      if (!container) return;
      if (!target.closest(".zd-enlarge-btn")) return;
      const svg = container.querySelector(DIAGRAM_SVG_SELECTOR);
      if (!svg) return;
      setScale(1);
      setTranslate({ x: 0, y: 0 });
      setPanActive(false);
      setOpen({ container, svgHtml: svg.outerHTML });
    }
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  // Re-clone svg when underlying diagram re-renders while dialog is open
  useEffect(() => {
    if (!open) return;
    const { container } = open;
    const observer = new MutationObserver(() => {
      const svg = container.querySelector(DIAGRAM_SVG_SELECTOR);
      if (svg && svg.outerHTML !== open.svgHtml) {
        setOpen({ container, svgHtml: svg.outerHTML });
      }
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [open]);

  const handleClose = useCallback(() => setOpen(null), []);

  const { dialogRef, handleBackdropClick } = useModalDialog({
    isOpen: open !== null,
    onClose: handleClose,
    navigateEvent: AFTER_NAVIGATE_EVENT,
    backdropClickClose: true,
  });

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(MAX_SCALE, s * ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => {
      const next = Math.max(MIN_SCALE, s / ZOOM_STEP);
      if (next <= MIN_SCALE) {
        setTranslate({ x: 0, y: 0 });
        setPanActive(false);
      }
      return next;
    });
  }, []);

  const togglePan = useCallback(() => {
    setPanActive((p) => !p);
  }, []);

  const clampTranslate = useCallback(
    (x: number, y: number, s: number) => {
      const inner = innerRef.current;
      if (!inner) return { x, y };
      const rect = inner.getBoundingClientRect();
      const baseW = rect.width / s;
      const baseH = rect.height / s;
      const maxX = Math.max(0, (baseW * s - baseW) / 2);
      const maxY = Math.max(0, (baseH * s - baseH) / 2);
      return {
        x: Math.max(-maxX, Math.min(maxX, x)),
        y: Math.max(-maxY, Math.min(maxY, y)),
      };
    },
    [],
  );

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      if (!panActive || scale <= MIN_SCALE) return;
      const d = dragState.current;
      d.dragging = true;
      d.startX = e.clientX;
      d.startY = e.clientY;
      d.originX = translate.x;
      d.originY = translate.y;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [panActive, scale, translate],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const d = dragState.current;
      if (!d.dragging) return;
      const nextX = d.originX + (e.clientX - d.startX);
      const nextY = d.originY + (e.clientY - d.startY);
      setTranslate(clampTranslate(nextX, nextY, scale));
    },
    [scale, clampTranslate],
  );

  const onPointerUp = useCallback((e: PointerEvent) => {
    const d = dragState.current;
    if (!d.dragging) return;
    d.dragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  const onViewportKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (scale <= MIN_SCALE) return;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = ARROW_PAN_STEP;
      else if (e.key === "ArrowRight") dx = -ARROW_PAN_STEP;
      else if (e.key === "ArrowUp") dy = ARROW_PAN_STEP;
      else if (e.key === "ArrowDown") dy = -ARROW_PAN_STEP;
      else return;
      e.preventDefault();
      setTranslate((t) => clampTranslate(t.x + dx, t.y + dy, scale));
    },
    [scale, clampTranslate],
  );

  const zoomed = scale > MIN_SCALE;
  const atMax = scale >= MAX_SCALE;

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      aria-label="Enlarged diagram"
      className={MERMAID_ENLARGE_DIALOG_CLASS}
      style={ENLARGE_DIALOG_STYLE}
    >
      {open && (
        <>
          <div
            className="zd-mermaid-viewport"
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onViewportKeyDown}
            data-pan-active={panActive && zoomed ? "" : undefined}
          >
            <div
              ref={innerRef}
              className="zd-mermaid-transform"
              style={{
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                transformOrigin: "center",
              }}
              dangerouslySetInnerHTML={{ __html: open.svgHtml }}
            />
          </div>

          <div className="zd-mermaid-toolbar" role="toolbar" aria-label="Diagram zoom controls">
            <button
              type="button"
              className="zd-mermaid-tool-btn"
              aria-label="Zoom in"
              onClick={zoomIn}
              disabled={atMax}
            >
              <PlusIcon />
            </button>
            <button
              type="button"
              className="zd-mermaid-tool-btn"
              aria-label="Zoom out"
              onClick={zoomOut}
              disabled={!zoomed}
            >
              <MinusIcon />
            </button>
            <button
              type="button"
              className="zd-mermaid-tool-btn"
              aria-label="Toggle pan mode"
              aria-pressed={panActive}
              onClick={togglePan}
              disabled={!zoomed}
            >
              <PanIcon />
            </button>
          </div>

          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="zd-enlarge-dialog-close"
            aria-label="Close enlarged diagram"
          >
            <svg viewBox="0 0 161.03 161.03" fill="currentColor" aria-hidden="true" focusable="false">
              <polygon points="161.03 10.27 150.76 0 80.51 70.24 10.27 0 0 10.27 70.24 80.51 0 150.76 10.27 161.03 80.51 90.78 150.76 161.03 161.03 150.76 90.78 80.51 161.03 10.27" />
            </svg>
          </button>
        </>
      )}
    </dialog>
  );
}
MermaidEnlarge.displayName = "MermaidEnlarge";

/**
 * Static SSR fallback for the {@link MermaidEnlarge} island.
 *
 * Renders an empty, closed `<dialog class="zd-mermaid-dialog ...">` so the
 * dist HTML carries the dialog shell even before hydration.
 */
export function MermaidEnlargeSsrFallback() {
  return <dialog aria-label="Enlarged diagram" className={MERMAID_ENLARGE_DIALOG_CLASS} style={ENLARGE_DIALOG_STYLE} />;
}
