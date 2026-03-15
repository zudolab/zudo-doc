import { useState, useEffect, useRef } from "react";

interface ColorTweakExportModalProps {
  onClose: () => void;
  colorState: {
    background: string;
    foreground: string;
    cursor: string;
    selectionBg: string;
    selectionFg: string;
    palette: string[];
    semantic: Record<string, string>;
    shikiTheme: string;
  };
}

function generateCode(colorState: ColorTweakExportModalProps["colorState"]): string {
  const { palette, semantic } = colorState;

  const paletteLines = palette
    .map((c, i) => {
      const isRowEnd = i % 4 === 3;
      const isLast = i === palette.length - 1;
      if (isRowEnd && !isLast) return `"${c}",\n    `;
      if (isRowEnd) return `"${c}",`;
      return `"${c}", `;
    })
    .join("");

  const semanticEntries = Object.entries(semantic);
  const semanticLines = semanticEntries
    .map(([key, value]) => `    ${key}: "${value}",`)
    .join("\n");

  return `{
  background: "${colorState.background}",
  foreground: "${colorState.foreground}",
  cursor: "${colorState.cursor}",
  selectionBg: "${colorState.selectionBg}",
  selectionFg: "${colorState.selectionFg}",
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
    setTimeout(() => setCopyLabel("Copy"), 2000);
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="mx-hsp-lg max-h-[80vh] w-full max-w-[40rem] overflow-y-auto border border-muted bg-surface p-hsp-xl backdrop:bg-bg/80"
      style={{ color: "var(--color-fg)" }}
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
