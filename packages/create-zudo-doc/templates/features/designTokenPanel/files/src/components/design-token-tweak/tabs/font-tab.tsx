import { useCallback, useMemo } from "react";
import SelectRow from "../controls/select-row";
import SliderRow from "../controls/slider-row";
import TextRow from "../controls/text-row";
import {
  FONT_GROUP_ORDER,
  FONT_TOKENS,
  GROUP_TITLES,
  type TokenDef,
  type TokenGroup,
} from "../tokens/manifest";
import type { TokenOverrides } from "../state/tweak-state";
import type { PersistFont } from "../state/persist";

interface FontTabProps {
  state: TokenOverrides;
  persistFont: PersistFont;
}

/**
 * Font tab — manifest-driven.
 *
 * Top-level sections (in `FONT_GROUP_ORDER`):
 *   - FONT SIZES        → slider rows (`--text-*`)
 *   - LINE HEIGHTS      → slider rows (`--leading-*`, unitless)
 *   - FONT WEIGHTS      → select rows (`--font-weight-*`, 100..900)
 *   - FONT FAMILIES     → text rows   (`--font-sans`, `--font-mono`)
 *
 * Advanced disclosure (`<details>`, collapsed by default) reveals the Tier 1
 * abstract scale (`--text-scale-*`). The Tier 2 font-size tokens above resolve
 * from these via `var()` in `global.css`, so edits to the scale cascade
 * automatically to the primary size rows without any extra wiring here.
 */
export default function FontTab({ state, persistFont }: FontTabProps) {
  const handleChange = useCallback(
    (id: string, next: string) => {
      persistFont((prev) => ({ ...prev, [id]: next }));
    },
    [persistFont],
  );

  const handleResetAll = useCallback(() => {
    persistFont(() => ({}));
  }, [persistFont]);

  // Group tokens once. Primary groups come from `FONT_GROUP_ORDER`; everything
  // flagged `advanced` goes into the disclosure section.
  const { primary, advanced } = useMemo(() => {
    const primary = new Map<TokenGroup, TokenDef[]>();
    const advanced: TokenDef[] = [];
    for (const t of FONT_TOKENS) {
      if (t.advanced) {
        advanced.push(t);
        continue;
      }
      const arr = primary.get(t.group) ?? [];
      arr.push(t);
      primary.set(t.group, arr);
    }
    return { primary, advanced };
  }, []);

  return (
    <div className="flex flex-col gap-vsp-sm">
      {/* Tab-level actions */}
      <div className="flex items-center gap-hsp-md">
        <button
          type="button"
          onClick={handleResetAll}
          className="text-accent hover:text-accent-hover transition-colors"
          style={{ fontSize: "0.75rem" }}
        >
          Reset Font
        </button>
      </div>

      {FONT_GROUP_ORDER.map((group) => {
        const tokens = primary.get(group);
        if (!tokens || tokens.length === 0) return null;
        return (
          <section key={group} className="shrink-0">
            <h3
              className="text-muted font-semibold mb-vsp-2xs"
              style={{
                fontSize: "0.8125rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {GROUP_TITLES[group]}
            </h3>
            <div className="grid grid-cols-1 gap-vsp-xs sm:grid-cols-2">
              {tokens.map((token) => (
                <TokenRow
                  key={token.id}
                  token={token}
                  value={state[token.id] ?? token.default}
                  onChange={(next) => handleChange(token.id, next)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {advanced.length > 0 && (
        <details className="shrink-0">
          <summary
            className="text-muted font-semibold cursor-pointer select-none"
            style={{
              fontSize: "0.8125rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {GROUP_TITLES["font-scale"]}
          </summary>
          <div className="grid grid-cols-1 gap-vsp-xs sm:grid-cols-2 mt-vsp-2xs">
            {advanced.map((token) => (
              <TokenRow
                key={token.id}
                token={token}
                value={state[token.id] ?? token.default}
                onChange={(next) => handleChange(token.id, next)}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/** Dispatch to the right control based on `token.control`. Defaults to slider. */
function TokenRow({
  token,
  value,
  onChange,
}: {
  token: TokenDef;
  value: string;
  onChange: (next: string) => void;
}) {
  switch (token.control) {
    case "select":
      return <SelectRow token={token} value={value} onChange={onChange} />;
    case "text":
      return <TextRow token={token} value={value} onChange={onChange} />;
    case "slider":
    default:
      return <SliderRow token={token} value={value} onChange={onChange} />;
  }
}
