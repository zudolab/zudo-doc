import { useState, useEffect, useCallback } from "react";
import {
  type TokenDef,
  formatValue,
  parseNumericValue,
} from "../tokens/manifest";

/**
 * One manifest-driven token row:
 *
 *   [label]  ... [  1.25 rem]   ← label + number input (unit suffix inside)
 *   [=========o==================]  ← full-width range slider
 *
 * Range input and number input are two-way bound: dragging the slider fills
 * the number input live, and typing a value moves the slider once it parses.
 *
 * The parent owns the persisted value (stored as a string like `"1.25rem"`);
 * this row keeps a local "draft" string only for the number input, so users
 * can type partial values (`"1."`) without the component thrashing.
 *
 * Read-only tokens render a disabled compact form that still shows the
 * resolved value from the stylesheet.
 */
export interface SliderRowProps {
  token: TokenDef;
  /** Current persisted value (or the token's default if no override). */
  value: string;
  /** Called with the new CSS string (e.g. `"0.75rem"`) whenever the user
   *  commits a change via slider or a parseable number input. */
  onChange: (next: string) => void;
}

export default function SliderRow({ token, value, onChange }: SliderRowProps) {
  // Numeric view of the stored value, used for the slider. Falls back to the
  // token min when the string can't be parsed (e.g. read-only clamp()).
  const numeric = parseNumericValue(value);
  const slidable = !token.readonly && numeric !== null;

  // Draft lets the user type freely ("1.", "1.2") without the slider snapping
  // every keystroke. We only commit (call onChange) when the draft parses.
  const [draft, setDraft] = useState<string>(numeric !== null ? String(numeric) : value);

  // Sync the draft when the external value changes (reset, preset load, etc.)
  useEffect(() => {
    setDraft(numeric !== null ? String(numeric) : value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = Number(e.currentTarget.value);
      if (!Number.isFinite(n)) return;
      setDraft(String(n));
      onChange(formatValue(n, token.unit));
    },
    [onChange, token.unit],
  );

  const handleNumber = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.currentTarget.value;
      setDraft(raw);
      const n = parseNumericValue(raw);
      if (n === null) return; // wait for a parseable value before committing
      // Clamp into the token's legal range on commit to keep the slider sane.
      const clamped = Math.min(token.max, Math.max(token.min, n));
      onChange(formatValue(clamped, token.unit));
    },
    [onChange, token.min, token.max, token.unit],
  );

  return (
    <div className="flex flex-col gap-[2px]">
      {/* Top row: label + number input */}
      <div className="flex items-center gap-hsp-sm">
        <span
          className="text-fg font-mono flex-1 truncate"
          style={{ fontSize: "0.8125rem" }}
          title={token.cssVar}
        >
          {token.label}
        </span>
        <div className="flex items-center gap-[4px] shrink-0">
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={handleNumber}
            disabled={token.readonly}
            className="bg-surface text-fg border border-muted px-[6px] py-[2px] font-mono text-right disabled:opacity-60"
            style={{
              fontSize: "0.75rem",
              width: "5rem",
              borderRadius: "var(--radius-DEFAULT)",
            }}
            aria-label={`${token.label} value`}
          />
          <span
            className="text-muted font-mono select-none"
            style={{ fontSize: "0.75rem", width: "2rem" }}
          >
            {token.readonly && !token.unit ? "" : token.unit}
          </span>
        </div>
      </div>

      {/* Bottom row: full-width slider */}
      <input
        type="range"
        min={token.min}
        max={token.max}
        step={token.step}
        // When unparseable, park the slider at min — it's disabled anyway.
        value={slidable ? (numeric as number) : token.min}
        onChange={handleSlider}
        disabled={!slidable}
        className="w-full disabled:opacity-50"
        style={{
          height: "1.25rem",
          accentColor: "var(--color-accent)",
        }}
        aria-label={`${token.label} slider`}
      />
    </div>
  );
}
