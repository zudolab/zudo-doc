// Ported from src/components/design-token-tweak/export-modal.tsx (E5 framework
// primitives). The serializer call (`serialize(state, { includeDefaults,
// colorDefaults, manifest })`) is intentionally byte-identical to the host
// project's version so the export output for an unchanged scheme remains
// line-equal to today's output — a hard acceptance criterion for the theme
// topic.
//
// W3-2 (zdtp-migration): migrated ColorTweakState/TweakState imports to the
// canonical shim in @/utils/design-token-types; removed initColorFromSchemeData
// (legacy panel helper deleted with src/components/design-token-tweak/).
//
// W3B (#1730 — Generator Pages Migration): switched serde + types imports to
// the v2-local relocations and added a required `manifest` prop. The
// manifest used to be sourced inside serde from
// `@/config/design-tokens-manifest`; the consumer now passes it in so the
// v2 modal carries no host-`@/` dependency.

import { useState, useEffect, useMemo, useRef } from "preact/hooks";
import { serialize, type DesignTokenManifest } from "./design-token-serde.js";
import {
  type ColorTweakState,
  type TweakState,
} from "./design-token-types.js";

interface DesignTokenExportModalProps {
  onClose: () => void;
  /** Full unified tweak state — the modal serializes all four categories. */
  state: TweakState;
  /** Token manifest (spacing / font / size arrays) used by serialize() to
   *  compute diff-only output. The caller is expected to forward the same
   *  manifest the panel was configured with. */
  manifest: DesignTokenManifest;
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
  // Explicit defaults take priority (normal path — the panel always passes them).
  // W3-2: initColorFromSchemeData removed with the legacy panel; fall through to
  // the caller-supplied fallback state for the rare edge case.
  return explicit ?? fallback;
}

export default function ColorTweakExportModal({
  onClose,
  state,
  manifest,
  colorDefaults,
}: DesignTokenExportModalProps) {
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [includeDefaults, setIncludeDefaults] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Memo the serialized JSON so flipping the toggle doesn't rebuild on every
  // re-render; `exportedAt` intentionally refreshes when the toggle flips so
  // the displayed timestamp reflects "when you clicked copy".
  const code = useMemo(() => {
    const baseline = resolveColorDefaults(state.color, colorDefaults);
    const json = serialize(state, {
      manifest,
      includeDefaults,
      colorDefaults: baseline,
    });
    return JSON.stringify(json, null, 2);
  }, [state, manifest, colorDefaults, includeDefaults]);

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

  // Use a structural event shape so this matches both React and Preact's
  // event handler types (the project runs Preact compat).
  function handleBackdropClick(e: { clientX: number; clientY: number }) {
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
      <h2 className="mb-vsp-sm text-title font-bold text-fg">
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
