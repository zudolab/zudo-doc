"use client";

/** @jsxRuntime automatic */
// Image-enlarge island — relocated from src/components/image-enlarge.tsx
// (host showcase) into the package as part of Package-First Wave 3 (S3,
// epic #2344). The browser-only observers and delegated listeners are owned
// by this island's activation scope.
//
// The `/api/ai-chat` endpoint stays host-side (showcase-only).
// CSS blocks (.zd-enlargeable, .zd-enlarge-btn, .zd-enlarge-dialog*) are
// shipped in @takazudo/zudo-doc/features.css (moved from src/styles/global.css).

import { computed, getScope, Show, signal } from "@takazudo/zfb/zudo-react";
import { AFTER_NAVIGATE_EVENT } from "../transitions/index.js";
import { modalDialog } from "../use-modal-dialog/index.js";
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
  const scope = getScope();
  const imgData = signal<ImageData | null>(null);
  const isOpen = computed(() => imgData.value !== null);
  const imageSrc = computed(() => {
    const current = imgData.value;
    return current ? current.currentSrc || current.src : "";
  });
  const imageSrcset = computed(() => imgData.value?.srcset ?? "");
  const imageHasSrcset = computed(() => Boolean(imgData.value?.srcset));
  const imageAlt = computed(() => imgData.value?.alt ?? "");

  // Eligibility detection and route-aware image scanning. All browser access
  // starts at activation so SSR and hydration begin from the same closed shell.
  scope.onActivate(() => {
    let active = true;
    const observedImages = new Set<HTMLImageElement>();
    const sharedResizeObserver = new ResizeObserver((entries) => {
      if (!active) return;
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
      const btn = container.querySelector<HTMLElement>(".zd-enlarge-btn");
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
      const content = document.querySelector("main .zd-content");
      if (!content) return;
      content.querySelectorAll<HTMLImageElement>(".zd-enlargeable img").forEach(observeImage);
    }

    function startObserving() {
      const content = document.querySelector("main .zd-content");
      if (content) {
        mutationObserver = new MutationObserver((mutations) => {
          if (!active) return;
          for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
              if (!(node instanceof Element)) continue;
              if (node.matches(".zd-enlargeable")) {
                node.querySelectorAll<HTMLImageElement>("img").forEach(observeImage);
              }
              if (node instanceof HTMLImageElement && node.closest(".zd-enlargeable")) {
                observeImage(node);
              }
              node.querySelectorAll<HTMLImageElement>(".zd-enlargeable img").forEach(observeImage);
            }
          }
        });
        mutationObserver.observe(content, { childList: true, subtree: true });
      }
      scanContent();
    }

    function handleWindowResize() {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!active) return;
        observedImages.forEach((img) => evaluateEligibility(img));
      }, 150);
    }

    function handleAfterNavigate() {
      if (!active) return;
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
    document.addEventListener(AFTER_NAVIGATE_EVENT, handleAfterNavigate);

    return () => {
      active = false;
      sharedResizeObserver.disconnect();
      observedImages.clear();
      mutationObserver?.disconnect();
      loadAbortController.abort();
      window.removeEventListener("resize", handleWindowResize);
      document.removeEventListener(AFTER_NAVIGATE_EVENT, handleAfterNavigate);
      clearTimeout(resizeTimer);
    };
  });

  // Click detection is delegated because the images live in authored MDX.
  scope.onActivate(() => {
    let active = true;
    function handleDocumentClick(event: Event) {
      if (!active || !(event.target instanceof Element)) return;
      const target = event.target;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      const container = target.closest(".zd-enlargeable");
      if (!container) return;
      if (!target.closest(".zd-enlarge-btn") && !target.closest("img")) return;
      const btn = container.querySelector<HTMLElement>(".zd-enlarge-btn");
      if (!btn || btn.hasAttribute("hidden")) return;
      const img = container.querySelector<HTMLImageElement>("img");
      if (!img) return;
      imgData.value = {
        src: img.src,
        currentSrc: img.currentSrc,
        srcset: img.srcset || undefined,
        sizes: img.sizes || undefined,
        alt: img.alt,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      };
    }
    document.addEventListener("click", handleDocumentClick);
    return () => {
      active = false;
      document.removeEventListener("click", handleDocumentClick);
    };
  });

  const handleClose = () => {
    imgData.value = null;
  };
  const { dialogRef, handleBackdropClick } = modalDialog(scope, {
    isOpen,
    onClose: handleClose,
    navigateEvent: AFTER_NAVIGATE_EVENT,
    backdropClickClose: true,
  });

  return (
    <dialog
      ref={dialogRef}
      on:click={handleBackdropClick}
      class={IMAGE_ENLARGE_DIALOG_CLASS}
      style={ENLARGE_DIALOG_STYLE}
    >
      <Show when={isOpen}>{() => (
        <>
          <div class="relative">
            <Show when={imageHasSrcset}>{() => (
              <img
                src={imageSrc}
                srcset={imageSrcset}
                sizes="85vw"
                alt={imageAlt}
                class="block max-h-[85vh] max-w-[85vw] object-contain"
              />
            )}</Show>
            <Show when={computed(() => !imageHasSrcset.value)}>{() => (
              <img
                src={imageSrc}
                alt={imageAlt}
                class="block max-h-[85vh] max-w-[85vw] object-contain"
              />
            )}</Show>
          </div>
          <button
            type="button"
            on:click={() => dialogRef.current?.close()}
            class="zd-enlarge-dialog-close"
            aria-label="Close enlarged image"
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
      class={IMAGE_ENLARGE_DIALOG_CLASS}
      style={ENLARGE_DIALOG_STYLE}
    />
  );
}
