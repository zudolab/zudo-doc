import { useCallback, useEffect, useRef } from "react";
import SliderRow from "./slider-row";
import type { TokenDef } from "../tokens/manifest";

/**
 * Slider row variant with a "Pill" checkbox on top.
 *
 *   [x] Pill (9999px)
 *   [label]  ... [9999 px]   ← inputs disabled while pill is on
 *   [=========o==================]
 *
 * When the checkbox is ON the token value is pinned to `token.pill.value`
 * (e.g. `"9999px"` for the full-radius sentinel) and the underlying slider /
 * number input go read-only so the user can't accidentally de-pill via typing.
 *
 * When the checkbox is OFF the row behaves as a normal `SliderRow` — the user
 * can drag or type any value in the manifest's min/max range.
 *
 * Toggling between modes preserves the last custom value (kept in a ref so we
 * don't round-trip it through state / persistence) — this is the "without data
 * loss" requirement from the Size sub-issue: you can flip Pill off to tweak
 * 16px, flip back on for the sentinel, flip off again and land on 16px.
 */
export interface PillSliderRowProps {
  /** Token must carry `token.pill` metadata. */
  token: TokenDef;
  /** Current persisted value (the manifest default if no override yet). */
  value: string;
  /** Called with the new CSS string whenever pill toggles or slider commits. */
  onChange: (next: string) => void;
}

export default function PillSliderRow({ token, value, onChange }: PillSliderRowProps) {
  if (!token.pill) {
    // Defensive: fall back to a normal row if the caller forgot to gate.
    return <SliderRow token={token} value={value} onChange={onChange} />;
  }

  const pillValue = token.pill.value;
  const customDefault = token.pill.customDefault;
  const isPill = value === pillValue;

  // Remember the last custom (non-pill) value so re-checking + un-checking
  // the pill doesn't wipe the user's tweak. Initialise from the incoming
  // value when the row first mounts while un-pilled.
  const lastCustomRef = useRef<string>(isPill ? customDefault : value);

  // Keep the ref in sync whenever the user changes the slider while un-pilled.
  useEffect(() => {
    if (!isPill) lastCustomRef.current = value;
  }, [isPill, value]);

  const handleTogglePill = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.currentTarget.checked) {
        onChange(pillValue);
      } else {
        onChange(lastCustomRef.current || customDefault);
      }
    },
    [onChange, pillValue, customDefault],
  );

  // While pilled, disable the inner SliderRow inputs by handing it a readonly
  // clone of the token. The row already knows how to render a readonly state
  // (disabled inputs, greyed slider), so we reuse that instead of inventing
  // a new disabled variant here.
  const effectiveToken: TokenDef = isPill ? { ...token, readonly: true } : token;

  return (
    <div className="flex flex-col gap-[4px]">
      <label className="flex items-center gap-hsp-xs shrink-0 cursor-pointer">
        <input
          type="checkbox"
          checked={isPill}
          onChange={handleTogglePill}
          style={{ accentColor: "var(--color-accent)" }}
          aria-label={`${token.label} pill toggle`}
        />
        <span className="text-muted font-mono" style={{ fontSize: "0.75rem" }}>
          Pill ({pillValue})
        </span>
      </label>
      <SliderRow token={effectiveToken} value={value} onChange={onChange} />
    </div>
  );
}
