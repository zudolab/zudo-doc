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

  // Delegated click handler — T5b will add eligibility checks here before setImgData
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
            onClick={() => dialogRef.current?.close()}
            className="absolute right-0 top-0 border border-muted bg-surface px-hsp-lg py-vsp-2xs text-small text-muted transition-colors hover:border-fg hover:text-fg"
            aria-label="Close enlarged image"
          >
            ×
          </button>
        </div>
      )}
    </dialog>
  );
}
