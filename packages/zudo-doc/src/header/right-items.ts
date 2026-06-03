// `filterHeaderRightItems` was moved here from the host's
// `src/utils/header-right-items.ts` (super-epic #1724, sub-issue #1729).
//
// Why it moved: keeping the filter inside v2 lets the package own the full
// header-rendering contract — `<Header>` only renders items the caller has
// approved, and the approval rule is colocated with the renderer. The
// previous version pulled `settings` straight from the host's `@/config`
// alias, which is exactly the kind of host-coupling W3A removes.
//
// The new shape takes a `flags` object instead. The host computes the
// flags from its own `settings` / `i18n` modules and passes them in,
// preserving the original filter logic without dragging any `@/` import
// across the package boundary.

import type { HeaderRightItem } from "./types.js";

/**
 * Runtime gates for `filterHeaderRightItems`.
 *
 * Mirrors the predicates in the legacy host-side helper (`src/utils/
 * header-right-items.ts` pre-#1729). Each flag corresponds to a specific
 * `settings.*` switch the original implementation consulted directly:
 *
 *   - `designTokenPanel` — `settings.designTokenPanel`
 *   - `aiAssistant`      — `settings.aiAssistant`
 *   - `colorMode`        — `Boolean(settings.colorMode)`
 *   - `hasLocales`       — `Object.keys(settings.locales).length > 0`
 *   - `hasVersions`      — `Boolean(settings.versions)`
 *   - `hasGithubUrl`     — `Boolean(settings.githubUrl)`
 */
export interface HeaderRightItemFlags {
  designTokenPanel: boolean;
  aiAssistant: boolean;
  colorMode: boolean;
  hasLocales: boolean;
  hasVersions: boolean;
  hasGithubUrl: boolean;
}

/**
 * Drop header-right items whose gating flag is off. Pure function — the
 * caller is responsible for computing the flags from host config.
 *
 * Items not gated by any flag (links, raw HTML, version-switcher when
 * versions are configured, search, …) pass through untouched.
 */
export function filterHeaderRightItems(
  items: HeaderRightItem[],
  flags: HeaderRightItemFlags,
): HeaderRightItem[] {
  return items.filter((item) => {
    if (item.type === "trigger") {
      if (item.trigger === "design-token-panel") {
        return flags.designTokenPanel;
      }
      if (item.trigger === "ai-chat") {
        return flags.aiAssistant;
      }
    }

    if (item.type === "component") {
      if (item.component === "theme-toggle") {
        return flags.colorMode;
      }
      if (item.component === "language-switcher") {
        return flags.hasLocales;
      }
      if (item.component === "version-switcher") {
        return flags.hasVersions;
      }
      if (item.component === "github-link") {
        return flags.hasGithubUrl;
      }
    }

    return true;
  });
}
