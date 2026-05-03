"use client";

// Use `preact/compat` so the bundle resolves to Preact's React-shim at
// runtime (zfb's esbuild step doesn't alias bare `react` to `preact/compat`).
// See `src/components/theme-toggle.tsx` for the same workaround in the
// hook-only case. preact/compat re-exports the same hooks plus the
// `React.*` type namespace for event handlers.
import { useState, useEffect, useRef } from "preact/compat";
// After zudolab/zudo-doc#1335 (E2 task 2 half B) the host components
// pull lifecycle event names from the v2 transitions module rather
// than hard-coding `astro:*` literals.
import { AFTER_NAVIGATE_EVENT } from "@zudo-doc/zudo-doc-v2/transitions";

interface ImageData {
  src: string;
  currentSrc: string;
  srcset?: string;
  sizes?: string;
  alt: string;
  naturalWidth: number;
  naturalHeight: number;
}

// Shared shell for the enlarge `<dialog>`. The hydrated component and
// the SSR fallback below render into the same Island container, so
// they MUST agree on class string and inline style — otherwise the
// dist HTML and the post-hydration DOM disagree on size / position
// and the first interaction flashes. Sourcing both from the same
// constants closes the drift gap GCO flagged in light-review.
const DIALOG_CLASS =
  "zd-enlarge-dialog mx-auto max-h-[90vh] max-w-[90vw] overflow-hidden border border-muted bg-surface p-0";
const DIALOG_STYLE = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
} as const;

export default function ImageEnlarge() {
  const [imgData, setImgData] = useState<ImageData | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Eligibility detection: toggle .zd-enlarge-btn[hidden] per image
  useEffect(() => {
    const resizeObservers = new Map<HTMLImageElement, ResizeObserver>();
    let mutationObserver: MutationObserver | null = null;
    let resizeTimer = 0;

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
      if (resizeObservers.has(img)) return;
      const ro = new ResizeObserver(() => evaluateEligibility(img));
      ro.observe(img);
      resizeObservers.set(img, ro);
      if (img.complete) {
        evaluateEligibility(img);
      } else {
        img.addEventListener("load", () => evaluateEligibility(img), { once: true });
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
        resizeObservers.forEach((_, img) => evaluateEligibility(img));
      }, 150);
    }

    function handleAfterSwap() {
      resizeObservers.forEach((ro) => ro.disconnect());
      resizeObservers.clear();
      mutationObserver?.disconnect();
      mutationObserver = null;
      startObserving();
    }

    startObserving();
    window.addEventListener("resize", handleWindowResize);
    document.addEventListener(AFTER_NAVIGATE_EVENT, handleAfterSwap);

    return () => {
      resizeObservers.forEach((ro) => ro.disconnect());
      resizeObservers.clear();
      mutationObserver?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      document.removeEventListener(AFTER_NAVIGATE_EVENT, handleAfterSwap);
      clearTimeout(resizeTimer);
    };
  }, []);

  useEffect(() => {
    function handleDocumentClick(e: MouseEvent) {
      const target = e.target as Element;
      const container = target.closest(".zd-enlargeable");
      if (!container) return;
      const btn = container.querySelector(".zd-enlarge-btn") as HTMLElement | null;
      // Eligibility gate: only open when the expand button is visible (image is large enough).
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

  // Open dialog when imgData is set
  useEffect(() => {
    if (!imgData) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
  }, [imgData]);

  // Handle cancel event (ESC key)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function handleCancel() {
      setImgData(null);
    }
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, []);

  // Reset state when dialog closes
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function handleClose() {
      setImgData(null);
    }
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  // Close and reset on page navigation
  useEffect(() => {
    function handleAfterSwap() {
      const dialog = dialogRef.current;
      if (dialog?.open) dialog.close();
      setImgData(null);
    }
    document.addEventListener(AFTER_NAVIGATE_EVENT, handleAfterSwap);
    return () => document.removeEventListener(AFTER_NAVIGATE_EVENT, handleAfterSwap);
  }, []);

  function handleBackdropClick(e: React.MouseEvent) {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      dialog.close();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className={DIALOG_CLASS}
      style={DIALOG_STYLE}
    >
      {imgData && (
        <>
          <div className="relative">
            <img
              src={imgData.currentSrc || imgData.src}
              srcSet={imgData.srcset}
              sizes={imgData.srcset ? "100vw" : undefined}
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

/**
 * Static SSR fallback for the {@link ImageEnlarge} island.
 *
 * Wave 11 (zudolab/zudo-doc#1355): the body-end Island wrapper renders
 * this on the server so the dist HTML carries an empty, closed
 * `<dialog class="zd-enlarge-dialog ...">` even before hydration. This:
 *
 *   1. Lets the smoke "exactly one zd-enlarge-dialog element" static
 *      HTML assertion pass without booting Preact.
 *   2. Gives the no-JS path a hidden-by-default dialog (a `<dialog>`
 *      without `open` is `display:none` per UA stylesheet), so screen
 *      readers and crawlers see the same shape they would post-hydration.
 *
 * The classes and inline style come from the shared `DIALOG_CLASS` /
 * `DIALOG_STYLE` constants at the top of this file so the SSR fallback
 * cannot drift from the hydrated `<dialog>` above. The post-hydration
 * component re-renders into the same Island container; any drift
 * would surface as a cosmetic flash on first interaction.
 */
export function ImageEnlargeSsrFallback() {
  return (
    <dialog
      className={DIALOG_CLASS}
      style={DIALOG_STYLE}
    />
  );
}
