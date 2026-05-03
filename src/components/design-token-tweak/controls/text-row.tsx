// preact/compat shim — see src/components/ai-chat-modal.tsx for rationale.
import { useCallback, useEffect, useState } from "preact/compat";
import type { TokenDef } from "../tokens/manifest";
import { sanitizeCssValue } from "./sanitize-css-value";

/**
 * One manifest-driven token row backed by a free-form text input.
 *
 *   [label]              [ "Inter", system-ui, sans-serif        ]
 *
 * Used for tokens whose value is a CSS string the user types directly — e.g.
 * `--font-sans` / `--font-mono`. The stored value is sanitised (see
 * `sanitize-css-value.ts`) before it leaves this component so newlines,
 * backslashes, and semicolons never reach stored state or the exported CSS
 * snippet. `style.setProperty` is already injection-safe on its own.
 */
export interface TextRowProps {
  token: TokenDef;
  /** Current persisted value (or the token's default if no override). */
  value: string;
  /** Called with the sanitised new value on every edit. */
  onChange: (next: string) => void;
}

export default function TextRow({ token, value, onChange }: TextRowProps) {
  // Local draft so the user can type freely without us round-tripping the
  // external value on every keystroke. We commit (sanitised) to the parent
  // immediately so live-preview stays responsive.
  const [draft, setDraft] = useState<string>(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.currentTarget.value;
      const sanitized = sanitizeCssValue(raw);
      setDraft(sanitized);
      onChange(sanitized);
    },
    [onChange],
  );

  return (
    <div className="flex items-center gap-hsp-sm">
      <span
        className="text-fg font-mono flex-1 truncate shrink-0"
        style={{ fontSize: "0.8125rem", maxWidth: "9rem" }}
        title={token.cssVar}
      >
        {token.label}
      </span>
      <input
        type="text"
        value={draft}
        onChange={handleChange}
        disabled={token.readonly}
        className="bg-surface text-fg border border-muted px-[6px] py-[2px] font-mono disabled:opacity-60 flex-1 min-w-0"
        style={{
          fontSize: "0.75rem",
          borderRadius: "var(--radius-DEFAULT)",
        }}
        aria-label={`${token.label} value`}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
      />
    </div>
  );
}
