"use client";

import { useCallback, useMemo } from "react";
import SliderRow from "../controls/slider-row";
import {
  GROUP_ORDER,
  GROUP_TITLES,
  SPACING_TOKENS,
  type TokenGroup,
  type TokenDef,
} from "../tokens/manifest";
import type { TokenOverrides } from "../state/tweak-state";
import type { PersistSpacing } from "../state/persist";

interface SpacingTabProps {
  state: TokenOverrides;
  persistSpacing: PersistSpacing;
}

/**
 * Spacing tab — fully manifest-driven.
 *
 * Iterates `SPACING_TOKENS` grouped by `group` field, renders one `SliderRow`
 * per token, and wires each row through `persistSpacing` so CSS vars + storage
 * stay in sync.
 */
export default function SpacingTab({ state, persistSpacing }: SpacingTabProps) {
  const handleChange = useCallback(
    (id: string, next: string) => {
      persistSpacing((prev) => ({ ...prev, [id]: next }));
    },
    [persistSpacing],
  );

  const handleResetAll = useCallback(() => {
    persistSpacing(() => ({}));
  }, [persistSpacing]);

  // Group tokens once so the render loop stays cheap and the display order
  // stays stable across re-renders. Uses a Partial map so new TokenGroup
  // variants added by sibling tabs (Size, Font) don't force updates here.
  const grouped = useMemo(() => {
    const out: Partial<Record<TokenGroup, TokenDef[]>> = {};
    for (const t of SPACING_TOKENS) {
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
          Reset Spacing
        </button>
      </div>

      {GROUP_ORDER.map((group) => {
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
