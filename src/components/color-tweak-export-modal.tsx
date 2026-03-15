import { useState, useEffect, useCallback, useRef } from "react";

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const code = generateCode(colorState);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
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
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/80"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Export Color Scheme"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="mx-hsp-lg max-h-[80vh] w-full max-w-[40rem] overflow-y-auto border border-muted bg-surface p-hsp-xl focus:outline-none"
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
            onClick={onClose}
            className="border border-muted bg-surface px-hsp-lg py-vsp-2xs text-small text-muted transition-colors hover:border-fg hover:text-fg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
