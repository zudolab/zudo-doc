import { useCallback } from "react";
import {
  type TweakState,
  type ColorTweakState,
  type TokenOverrides,
  applyFullState,
  savePersistedState,
} from "./tweak-state";

type SetState<T> = (updater: (prev: T | null) => T | null) => void;

/**
 * Hook returning a `persist` callback and tab-scoped helpers.
 *
 * `persist(updater)` runs the whole-state updater, applies the resulting CSS
 * variables to `:root`, and writes the v2 key to localStorage. Tab components
 * use the more focused `persistColor` / `persistSpacing` helpers so they can
 * stay unaware of the v2 envelope.
 */
export function usePersist(setState: SetState<TweakState>) {
  const persist = useCallback(
    (updater: (prev: TweakState) => TweakState) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        applyFullState(next);
        savePersistedState(next);
        return next;
      });
    },
    [setState],
  );

  const persistColor = useCallback(
    (updater: (prev: ColorTweakState) => ColorTweakState) => {
      persist((prev) => ({ ...prev, color: updater(prev.color) }));
    },
    [persist],
  );

  const persistSpacing = useCallback(
    (updater: (prev: TokenOverrides) => TokenOverrides) => {
      persist((prev) => ({ ...prev, spacing: updater(prev.spacing) }));
    },
    [persist],
  );

  return { persist, persistColor, persistSpacing };
}

export type Persist = ReturnType<typeof usePersist>["persist"];
export type PersistColor = ReturnType<typeof usePersist>["persistColor"];
export type PersistSpacing = ReturnType<typeof usePersist>["persistSpacing"];
