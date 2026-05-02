"use client";

import { useCallback, useMemo } from "react";
import PillSliderRow from "../controls/pill-slider-row";
import SliderRow from "../controls/slider-row";
import {
  GROUP_TITLES,
  SIZE_GROUP_ORDER,
  SIZE_TOKENS,
  type TokenDef,
  type TokenGroup,
} from "../tokens/manifest";
import type { TokenOverrides } from "../state/tweak-state";
import type { PersistSize } from "../state/persist";

interface SizeTabProps {
  state: TokenOverrides;
  persistSize: PersistSize;
}

/**
 * Size tab — manifest-driven like Spacing, with one pill-toggle special case
 * (`--radius-full`).
 *
 * Groups: BORDER RADIUS, TRANSITIONS. If the manifest grows a new group, add
 * it to `SIZE_GROUP_ORDER` in `tokens/manifest.ts` — no code change needed
 * here.
 */
export default function SizeTab({ state, persistSize }: SizeTabProps) {
  const handleChange = useCallback(
    (id: string, next: string) => {
      persistSize((prev) => ({ ...prev, [id]: next }));
    },
    [persistSize],
  );

  const handleResetAll = useCallback(() => {
    persistSize(() => ({}));
  }, [persistSize]);

  // Group tokens once (Partial map — any TokenGroup not in SIZE_TOKENS
  // simply stays undefined and the render skips it).
  const grouped = useMemo(() => {
    const out: Partial<Record<TokenGroup, TokenDef[]>> = {};
    for (const t of SIZE_TOKENS) {
      (out[t.group] ??= []).push(t);
    }
    return out;
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
          Reset Size
        </button>
      </div>

      {SIZE_GROUP_ORDER.map((group) => {
        const tokens = grouped[group];
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
              {tokens.map((token) => {
                const value = state[token.id] ?? token.default;
                if (token.pill) {
                  return (
                    <PillSliderRow
                      key={token.id}
                      token={token}
                      value={value}
                      onChange={(next) => handleChange(token.id, next)}
                    />
                  );
                }
                return (
                  <SliderRow
                    key={token.id}
                    token={token}
                    value={value}
                    onChange={(next) => handleChange(token.id, next)}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
