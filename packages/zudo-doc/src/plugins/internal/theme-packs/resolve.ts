// plugins/internal/theme-packs/resolve — thin wrapper composing #2819's
// `loadThemePackRegistry` + `resolveEnabledPacks` against a plugin options
// shape (ADR docs/adr/theme-packs.md, Decision 2, #2820). Shared by the
// theme-packs plugin's `setup`/`postBuild`/`devMiddleware` hooks so all three
// resolve identically — no cached/mutable state crosses hook invocations;
// each hook call re-derives the resolved set from its own `ctx.options`,
// mirroring `routes.ts`'s `setup()` shape.

import {
  loadThemePackRegistry,
  resolveEnabledPacks,
  type ThemePackRegistry,
} from "../../../theme-packs-registry/index.js";
import type { ThemePacksPluginOptions } from "./types.js";

/**
 * Resolve the ENABLED, ORDERED pack registry for `options` against the
 * shipped `packsDir`. Throws — naming the offending pack/slug — on a broken
 * bundled pack (`loadThemePackRegistry`) or an unknown/duplicate configured
 * slug (`resolveEnabledPacks`); this is the fail-loudly precedent every hook
 * (`setup`, `postBuild`, `devMiddleware`) relies on (never a silent
 * fallback).
 */
export function resolveThemePacksForOptions(
  packsDir: string | URL,
  options: ThemePacksPluginOptions,
): ThemePackRegistry {
  return resolveEnabledPacks(loadThemePackRegistry(packsDir), {
    themePack: options.themePack,
    themePacks: options.themePacks,
  });
}

/**
 * Whether the resolved enabled set has anything worth copying/serving — the
 * ADR's dead-weight-avoidance rule: "no-ops when the resolved enabled set has
 * no CSS-bearing pack (i.e. only `default`)".
 */
export function hasCssBearingPack(enabled: ThemePackRegistry): boolean {
  return enabled.some((entry) => entry.hasStylesheet);
}
