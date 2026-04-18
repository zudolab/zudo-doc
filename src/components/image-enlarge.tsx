import { useState, useEffect, useRef } from "react";

interface ImageData {
  src: string;
  currentSrc: string;
  srcset?: string;
  sizes?: string;
  alt: string;
  naturalWidth: number;
  naturalHeight: number;
}

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
    document.addEventListener("astro:after-swap", handleAfterSwap);

    return () => {
      resizeObservers.forEach((ro) => ro.disconnect());
      resizeObservers.clear();
      mutationObserver?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      document.removeEventListener("astro:after-swap", handleAfterSwap);
      clearTimeout(resizeTimer);
    };
  }, []);

  useEffect(() => {
    function handleDocumentClick(e: MouseEvent) {
      const target = e.target as Element;
      const btn = target.closest(".zd-enlarge-btn");
      if (!btn) return;
      const container = btn.closest(".zd-enlargeable");
      if (!container) return;
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

  // Close and reset on ClientRouter navigation
  useEffect(() => {
    function handleAfterSwap() {
      const dialog = dialogRef.current;
      if (dialog?.open) dialog.close();
      setImgData(null);
    }
    document.addEventListener("astro:after-swap", handleAfterSwap);
    return () => document.removeEventListener("astro:after-swap", handleAfterSwap);
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
      className="zd-enlarge-dialog mx-auto max-h-[90vh] max-w-[90vw] overflow-hidden border border-muted bg-surface p-0"
      style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
    >
      {imgData && (
        <div className="relative">
          <img
            src={imgData.currentSrc || imgData.src}
            srcSet={imgData.srcset}
            sizes={imgData.srcset ? "100vw" : undefined}
            alt={imgData.alt}
            className="block max-h-[85vh] max-w-[85vw] object-contain"
          />
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="zd-enlarge-dialog-close absolute right-0 top-0"
            aria-label="Close enlarged image"
          >
            <svg viewBox="0 0 161.03 161.03" fill="currentColor" aria-hidden="true" focusable={false}>
              <polygon points="161.03 10.27 150.76 0 80.51 70.24 10.27 0 0 10.27 70.24 80.51 0 150.76 10.27 161.03 80.51 90.78 150.76 161.03 161.03 150.76 90.78 80.51 161.03 10.27" />
            </svg>
          </button>
        </div>
      )}
    </dialog>
  );
}
