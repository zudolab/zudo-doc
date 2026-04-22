import { useCallback } from "react";
import type { TokenDef } from "../tokens/manifest";

/**
 * One manifest-driven token row backed by a native `<select>`.
 *
 *   [label]                                     [  400 ▾]
 *
 * Used for tokens whose value is one of a small, enumerated set — e.g.
 * `--font-weight-*` (100..900). The selected option string is stored verbatim
 * in persisted state (no numeric round-tripping; font-weight values are
 * conventionally written as bare numbers in CSS).
 */
export interface SelectRowProps {
  token: TokenDef;
  /** Current persisted value (or the token's default if no override). */
  value: string;
  /** Called with the newly selected option value. */
  onChange: (next: string) => void;
}

export default function SelectRow({ token, value, onChange }: SelectRowProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(e.currentTarget.value);
    },
    [onChange],
  );

  const options = token.options ?? [];
  // Make sure the current value renders even if it isn't in `options` (e.g. a
  // legacy persisted value from an older manifest). Appending it keeps the
  // select from silently losing the user's state.
  const includesValue = options.includes(value);

  return (
    <div className="flex items-center gap-hsp-sm">
      <span
        className="text-fg font-mono flex-1 truncate"
        style={{ fontSize: "0.8125rem" }}
        title={token.cssVar}
      >
        {token.label}
      </span>
      <select
        value={value}
        onChange={handleChange}
        disabled={token.readonly}
        className="bg-surface text-fg border border-muted px-[6px] py-[2px] font-mono disabled:opacity-60"
        style={{
          fontSize: "0.75rem",
          width: "7rem",
          borderRadius: "var(--radius-DEFAULT)",
        }}
        aria-label={`${token.label} value`}
      >
        {!includesValue && (
          <option key={`__fallback:${value}`} value={value}>
            {value}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
