"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// Image-enlarge island — relocated from src/components/image-enlarge.tsx
// (host showcase) into the package as part of Package-First Wave 3 (S3,
// epic #2344). Uses shared hook + constants from S1a foundation:
//   - useModalDialog  from @takazudo/zudo-doc/use-modal-dialog
//   - IMAGE_ENLARGE_DIALOG_CLASS / ENLARGE_DIALOG_STYLE from @takazudo/zudo-doc/island-types
//
// The `/api/ai-chat` endpoint stays host-side (showcase-only).
// CSS blocks (.zd-enlargeable, .zd-enlarge-btn, .zd-enlarge-dialog*) are
// shipped in @takazudo/zudo-doc/features.css (moved from src/styles/global.css).

import { useState, useEffect } from "preact/compat";
import { AFTER_NAVIGATE_EVENT } from "../transitions/index.js";
import { useModalDialog } from "../use-modal-dialog/index.js";
import {
  IMAGE_ENLARGE_DIALOG_CLASS,
  ENLARGE_DIALOG_STYLE,
} from "../island-types/index.js";

interface ImageData {
  src: string;
  currentSrc: string;
  srcset?: string;
  sizes?: string;
  alt: string;
  naturalWidth: number;
  naturalHeight: number;
}

export function ImageEnlarge() {
  const [imgData, setImgData] = useState<ImageData | null>(null);

  // Eligibility detection: toggle .zd-enlarge-btn[hidden] per image
  useEffect(() => {
    const observedImages = new Set<HTMLImageElement>();
    const sharedResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        evaluateEligibility(entry.target as HTMLImageElement);
      }
    });
    let mutationObserver: MutationObserver | null = null;
    let resizeTimer = 0;
    let loadAbortController = new AbortController();

    function evaluateEligibility(img: HTMLImageElement) {
      const container = img.closest(".zd-enlargeable");
      if (!container) return;
      const btn = container.querySelector(".zd-enlarge-btn") as HTMLElement | null;
      if (!btn) return;
      const eligible = img.naturalWidth > img.clientWidth * window.devicePixelRatio;
      if (eligible) {
        btn.removeAttribute("hidden");
      } else {
        btn.setAttribute("hidden", "");
      }
    }

    function observeImage(img: HTMLImageElement) {
      if (observedImages.has(img)) return;
      observedImages.add(img);
      sharedResizeObserver.observe(img);
      if (img.complete) {
        evaluateEligibility(img);
      } else {
        img.addEventListener(
          "load",
          () => evaluateEligibility(img),
          { once: true, signal: loadAbortController.signal },
        );
      }
    }

    function scanContent() {
      const scope = document.querySelector("main .zd-content");
      if (!scope) return;
      scope.querySelectorAll<HTMLImageElement>(".zd-enlargeable img").forEach(observeImage);
    }

    function startObserving() {
      const scope = document.querySelector("main .zd-content");
      if (scope) {
        mutationObserver = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
              if (!(node instanceof Element)) continue;
              if (node.matches(".zd-enlargeable")) {
                node.querySelectorAll<HTMLImageElement>("img").forEach(observeImage);
              }
              node.querySelectorAll<HTMLImageElement>(".zd-enlargeable img").forEach(observeImage);
            }
          }
        });
        mutationObserver.observe(scope, { childList: true, subtree: true });
      }
      scanContent();
    }

    function handleWindowResize() {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        observedImages.forEach((img) => evaluateEligibility(img));
      }, 150);
    }

    function handleAfterSwap() {
      sharedResizeObserver.disconnect();
      observedImages.clear();
      mutationObserver?.disconnect();
      mutationObserver = null;
      loadAbortController.abort();
      loadAbortController = new AbortController();
      startObserving();
    }

    startObserving();
    window.addEventListener("resize", handleWindowResize);
    document.addEventListener(AFTER_NAVIGATE_EVENT, handleAfterSwap);

    return () => {
      sharedResizeObserver.disconnect();
      observedImages.clear();
      mutationObserver?.disconnect();
      loadAbortController.abort();
      window.removeEventListener("resize", handleWindowResize);
      document.removeEventListener(AFTER_NAVIGATE_EVENT, handleAfterSwap);
      clearTimeout(resizeTimer);
    };
  }, []);

  useEffect(() => {
    function handleDocumentClick(e: MouseEvent) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const target = e.target as Element;
      const container = target.closest(".zd-enlargeable");
      if (!container) return;
      if (!target.closest(".zd-enlarge-btn") && !target.closest("img")) return;
      const btn = container.querySelector(".zd-enlarge-btn") as HTMLElement | null;
      if (!btn || btn.hasAttribute("hidden")) return;
      const img = container.querySelector("img") as HTMLImageElement | null;
      if (!img) return;
      setImgData({
        src: img.src,
        currentSrc: img.currentSrc,
        srcset: img.srcset || undefined,
        sizes: img.sizes || undefined,
        alt: img.alt,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      });
    }
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  const handleClose = () => setImgData(null);

  const { dialogRef, handleBackdropClick } = useModalDialog({
    isOpen: imgData !== null,
    onClose: handleClose,
    navigateEvent: AFTER_NAVIGATE_EVENT,
    backdropClickClose: true,
  });

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className={IMAGE_ENLARGE_DIALOG_CLASS}
      style={ENLARGE_DIALOG_STYLE}
    >
      {imgData && (
        <>
          <div className="relative">
            <img
              src={imgData.currentSrc || imgData.src}
              srcSet={imgData.srcset}
              sizes={imgData.srcset ? "85vw" : undefined}
              alt={imgData.alt}
              className="block max-h-[85vh] max-w-[85vw] object-contain"
            />
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="zd-enlarge-dialog-close"
            aria-label="Close enlarged image"
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
ImageEnlarge.displayName = "ImageEnlarge";

/**
 * Static SSR fallback for the {@link ImageEnlarge} island.
 *
 * Renders an empty, closed `<dialog class="zd-enlarge-dialog ...">` so the
 * dist HTML carries the dialog shell even before hydration. Sources its
 * class and inline style from the shared constants in island-types so the
 * SSR fallback cannot drift from the hydrated dialog above.
 */
export function ImageEnlargeSsrFallback() {
  return (
    <dialog
      className={IMAGE_ENLARGE_DIALOG_CLASS}
      style={ENLARGE_DIALOG_STYLE}
    />
  );
}
