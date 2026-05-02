"use client";

import { useEffect, useRef, useState } from "react";
import {
  DESIGN_TOKEN_SCHEMA,
  DesignTokenSchemaError,
  deserialize,
} from "@/utils/design-token-serde";
import type {
  ColorTweakState,
  TweakState,
} from "./state/tweak-state";

interface DesignTokenImportModalProps {
  onClose: () => void;
  /** Called with the parsed state when the user hits "Load". The caller is
   *  responsible for applying it to the panel + persisting it. */
  onLoad: (state: TweakState) => void;
  /** Color baseline filled in for fields absent from the payload. */
  colorDefaults: ColorTweakState;
}

interface InlineNote {
  kind: "error" | "info";
  text: string;
}

export default function DesignTokenImportModal({
  onClose,
  onLoad,
  colorDefaults,
}: DesignTokenImportModalProps) {
  const [text, setText] = useState("");
  const [note, setNote] = useState<InlineNote | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    // Autofocus the textarea so the user can paste immediately.
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
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

  function handleLoad() {
    setNote(null);
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setNote({ kind: "error", text: "Paste a JSON blob first." });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setNote({ kind: "error", text: `JSON parse error: ${message}` });
      return;
    }

    try {
      const { state, unknownTokens, warnings } = deserialize(parsed, {
        colorDefaults,
      });

      if (unknownTokens.length > 0) {
        // Grouped console.warn so developers can inspect the list without
        // drowning in separate log lines.
        // eslint-disable-next-line no-console
        console.groupCollapsed(
          `[design-token-serde] ${unknownTokens.length} unknown token${
            unknownTokens.length === 1 ? "" : "s"
          } ignored while loading JSON`,
        );
        for (const name of unknownTokens) {
          // eslint-disable-next-line no-console
          console.warn(name);
        }
        // eslint-disable-next-line no-console
        console.groupEnd();
      }

      if (warnings.length > 0) {
        // eslint-disable-next-line no-console
        console.warn("[design-token-serde] warnings:", warnings);
      }

      onLoad(state);

      // "Nothing applied" = every spacing/font/size override landed in
      // unknownTokens (so the payload had data but nothing mapped), AND the
      // color block didn't change anything either. Surface a stronger warning
      // so the user isn't left thinking the import silently succeeded.
      const appliedCount =
        Object.keys(state.spacing).length +
        Object.keys(state.font).length +
        Object.keys(state.size).length;
      const colorLooksUntouched =
        !parsed ||
        typeof parsed !== "object" ||
        (parsed as Record<string, unknown>).color === undefined;
      const nothingApplied =
        appliedCount === 0 && colorLooksUntouched && unknownTokens.length > 0;

      if (nothingApplied) {
        setNote({
          kind: "error",
          text: `Nothing applied — all ${unknownTokens.length} token${
            unknownTokens.length === 1 ? "" : "s"
          } in the payload were unknown. See console for the list.`,
        });
      } else if (unknownTokens.length > 0) {
        setNote({
          kind: "info",
          text: `Loaded. ${unknownTokens.length} unknown token${
            unknownTokens.length === 1 ? "" : "s"
          } ignored — see console for the list.`,
        });
      } else {
        setNote({ kind: "info", text: "Loaded." });
      }
    } catch (err) {
      if (err instanceof DesignTokenSchemaError) {
        if (err.reason === "schema-mismatch") {
          setNote({
            kind: "error",
            text: `Schema mismatch: this panel expects "${DESIGN_TOKEN_SCHEMA}".`,
          });
        } else if (err.reason === "schema-missing") {
          setNote({
            kind: "error",
            text: `Missing "$schema" key. Expected "${DESIGN_TOKEN_SCHEMA}".`,
          });
        } else {
          setNote({ kind: "error", text: "Input is not a JSON object." });
        }
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      setNote({ kind: "error", text: `Load failed: ${message}` });
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="mx-auto max-h-[80vh] w-full max-w-[46rem] overflow-y-auto border border-muted bg-surface p-hsp-xl backdrop:bg-bg/80"
      style={{ color: "var(--color-fg)", position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", userSelect: "text" }}
    >
      <h2 className="mb-vsp-sm text-subheading font-bold text-fg">
        Load Design Tokens
      </h2>

      <p className="mb-vsp-xs text-small text-muted">
        Paste a <code className="text-fg">{DESIGN_TOKEN_SCHEMA}</code> JSON
        blob. Unknown tokens are ignored; schema mismatch aborts the load.
      </p>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        spellCheck={false}
        className="h-[18rem] w-full resize-y border border-muted bg-code-bg p-hsp-sm text-small text-code-fg font-mono"
        placeholder='{ "$schema": "zudo-doc-design-tokens/v1", ... }'
      />

      {note && (
        <p
          role={note.kind === "error" ? "alert" : "status"}
          className={`mt-vsp-2xs text-small ${
            note.kind === "error" ? "text-danger" : "text-fg"
          }`}
        >
          {note.text}
        </p>
      )}

      <div className="mt-vsp-sm flex items-center gap-x-hsp-md">
        <button
          type="button"
          onClick={handleLoad}
          className="border border-muted bg-surface px-hsp-lg py-vsp-2xs text-small text-fg transition-colors hover:border-accent hover:text-accent"
        >
          Load
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
