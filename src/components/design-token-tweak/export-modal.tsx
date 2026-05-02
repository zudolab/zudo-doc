"use client";

// preact/compat shim — see src/components/ai-chat-modal.tsx for rationale.
import { useState, useEffect, useMemo, useRef } from "preact/compat";
import { serialize } from "@/utils/design-token-serde";
import {
  type ColorTweakState,
  type TweakState,
  initColorFromSchemeData,
} from "./state/tweak-state";
import { colorSchemes } from "@/config/color-schemes";

interface DesignTokenExportModalProps {
  onClose: () => void;
  /** Full unified tweak state — the modal serializes all four categories. */
  state: TweakState;
  /** Color baseline used for diff-only output. Optional: callers without DOM
   *  access (tests) can omit and we'll treat the entire color block as changed. */
  colorDefaults?: ColorTweakState;
}

const EXPORT_FILENAME_HINT = "zudo-doc-tokens.json";

/** Resolve a color baseline for diff-only serialization. */
function resolveColorDefaults(
  fallback: ColorTweakState,
  explicit?: ColorTweakState,
): ColorTweakState {
  if (explicit) return explicit;
  // No explicit defaults → pick the first scheme so we still produce a
  // sensible baseline shape. This path is only hit in edge cases; the panel
  // always passes explicit defaults.
  const firstScheme = Object.values(colorSchemes)[0];
  if (firstScheme) return initColorFromSchemeData(firstScheme);
  return fallback;
}

export default function DesignTokenExportModal({
  onClose,
  state,
  colorDefaults,
}: DesignTokenExportModalProps) {
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [includeDefaults, setIncludeDefaults] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Memo the serialized JSON so flipping the toggle doesn't rebuild on every
  // re-render; `exportedAt` intentionally refreshes when the toggle flips so
  // the displayed timestamp reflects "when you clicked copy".
  const code = useMemo(() => {
    const baseline = resolveColorDefaults(state.color, colorDefaults);
    const json = serialize(state, {
      includeDefaults,
      colorDefaults: baseline,
    });
    return JSON.stringify(json, null, 2);
  }, [state, colorDefaults, includeDefaults]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function handleClose() {
      onClose();
    }
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
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

  async function handleCopy() {
    let ok = false;
    // Clipboard API needs focus inside the dialog — use a dialog-scoped
    // textarea fallback that works even inside Safari's <dialog> focus trap.
    const dialog = dialogRef.current;
    if (dialog) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.style.cssText = "position:fixed;opacity:0;left:-9999px";
        dialog.appendChild(textarea);
        textarea.focus();
        textarea.select();
        ok = document.execCommand("copy");
        dialog.removeChild(textarea);
      } catch { /* ignore */ }
    }
    if (!ok) {
      // Last resort: try Clipboard API
      try {
        await navigator.clipboard.writeText(code);
        ok = true;
      } catch { /* ignore */ }
    }
    setCopyLabel(ok ? "Copied!" : "Failed");
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopyLabel("Copy"), 2000);
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="mx-auto max-h-[80vh] w-full max-w-[46rem] overflow-y-auto border border-muted bg-surface p-hsp-xl backdrop:bg-bg/80"
      style={{ color: "var(--color-fg)", position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", userSelect: "text" }}
    >
      <h2 className="mb-vsp-sm text-subheading font-bold text-fg">
        Export Design Tokens
      </h2>

      <p className="mb-vsp-xs text-small text-muted">
        Save as <code className="text-fg">{EXPORT_FILENAME_HINT}</code> to feed
        this blob back into the panel (or hand to an AI assistant).
      </p>

      <label className="mb-vsp-xs flex items-center gap-x-hsp-sm text-small text-fg">
        <input
          type="checkbox"
          checked={includeDefaults}
          onChange={(e) => setIncludeDefaults(e.currentTarget.checked)}
        />
        Show defaults too
      </label>

      <pre className="overflow-x-auto border border-muted bg-code-bg p-hsp-lg text-small text-code-fg">
        <code>{code}</code>
      </pre>

      <div className="mt-vsp-sm flex items-center gap-x-hsp-md">
        <button
          type="button"
          onClick={handleCopy}
          className="border border-muted bg-surface px-hsp-lg py-vsp-2xs text-small text-fg transition-colors hover:border-accent hover:text-accent"
        >
          {copyLabel}
        </button>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="border border-muted bg-surface px-hsp-lg py-vsp-2xs text-small text-muted transition-colors hover:border-fg hover:text-fg"
        >
          Close
        </button>
      </div>
    </dialog>
  );
}
