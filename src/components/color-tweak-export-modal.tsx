import { useState, useEffect, useRef } from "react";

interface ColorTweakExportModalProps {
  onClose: () => void;
  colorState: {
    background: number;
    foreground: number;
    cursor: number;
    selectionBg: number;
    selectionFg: number;
    palette: string[];
    semanticMappings: Record<string, number | "bg" | "fg">;
    shikiTheme: string;
  };
}

function generateCode(colorState: ColorTweakExportModalProps["colorState"]): string {
  const { palette, semanticMappings } = colorState;

  const paletteLines = palette
    .map((c, i) => {
      const isRowEnd = i % 4 === 3;
      const isLast = i === palette.length - 1;
      if (isRowEnd && !isLast) return `"${c}",\n    `;
      if (isRowEnd) return `"${c}",`;
      return `"${c}", `;
    })
    .join("");

  const semanticEntries = Object.entries(semanticMappings);
  const semanticLines = semanticEntries
    .map(([key, value]) => {
      if (typeof value === "string") return `    ${key}: "${value}",`;
      return `    ${key}: ${value},`;
    })
    .join("\n");

  return `{
  background: ${colorState.background},
  foreground: ${colorState.foreground},
  cursor: ${colorState.cursor},
  selectionBg: ${colorState.selectionBg},
  selectionFg: ${colorState.selectionFg},
  palette: [
    ${paletteLines}
  ],
  shikiTheme: "${colorState.shikiTheme}",${
    semanticEntries.length > 0
      ? `\n  semantic: {\n${semanticLines}\n  },`
      : ""
  }
}`;
}

export default function ColorTweakExportModal({
  onClose,
  colorState,
}: ColorTweakExportModalProps) {
  const [copyLabel, setCopyLabel] = useState("Copy");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const code = generateCode(colorState);

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
    try {
      await navigator.clipboard.writeText(code);
      setCopyLabel("Copied!");
    } catch {
      setCopyLabel("Failed");
    }
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopyLabel("Copy"), 2000);
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="mx-auto max-h-[80vh] w-full max-w-[40rem] overflow-y-auto border border-muted bg-surface p-hsp-xl backdrop:bg-bg/80"
      style={{ color: "var(--color-fg)", position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
    >
      <h2 className="mb-vsp-sm text-subheading font-bold text-fg">
        Export Color Scheme
      </h2>

      <pre className="overflow-x-auto border border-muted bg-code-bg p-hsp-lg text-small text-code-fg">
        <code>{code}</code>
      </pre>

      <div className="mt-vsp-sm flex items-center gap-x-hsp-md">
        <button
          onClick={handleCopy}
          className="border border-muted bg-surface px-hsp-lg py-vsp-2xs text-small text-fg transition-colors hover:border-accent hover:text-accent"
        >
          {copyLabel}
        </button>
        <button
          onClick={() => dialogRef.current?.close()}
          className="border border-muted bg-surface px-hsp-lg py-vsp-2xs text-small text-muted transition-colors hover:border-fg hover:text-fg"
        >
          Close
        </button>
      </div>
    </dialog>
  );
}
