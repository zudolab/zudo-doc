/**
 * Feature modules for the scaffold composition engine.
 *
 * Each module is a FeatureModule function that returns a FeatureDefinition
 * based on user choices. The definition includes:
 * - files: feature-specific files to copy
 * - injections: code to inject into shared files at anchor points
 * - postProcess: optional hook for complex transformations
 */

import type { FeatureModule } from "../compose.js";
import { searchFeature } from "./search.js";
import { footerFeature } from "./footer.js";
import { sidebarResizerFeature } from "./sidebar-resizer.js";
import { sidebarToggleFeature } from "./sidebar-toggle.js";
import { docHistoryFeature } from "./doc-history.js";
import { llmsTxtFeature } from "./llms-txt.js";
import { claudeResourcesFeature } from "./claude-resources.js";
import { colorTweakPanelFeature } from "./color-tweak-panel.js";
import { i18nFeature } from "./i18n.js";
import { versioningFeature } from "./versioning.js";

/**
 * All feature modules keyed by their feature name.
 * The "footer" key is a pseudo-feature triggered by footerNavGroup or footerCopyright.
 * Order matches FEATURES array in constants.ts for deterministic injection.
 */
export const featureModules: Record<string, FeatureModule> = {
  i18n: i18nFeature,
  search: searchFeature,
  // sidebarFilter — built into sidebar-tree.tsx, stays in base
  claudeResources: claudeResourcesFeature,
  colorTweakPanel: colorTweakPanelFeature,
  sidebarResizer: sidebarResizerFeature,
  sidebarToggle: sidebarToggleFeature,
  versioning: versioningFeature,
  docHistory: docHistoryFeature,
  llmsTxt: llmsTxtFeature,
  // skillSymlinker — handled in scaffold.ts
  footer: footerFeature, // pseudo-feature: triggered by footerNavGroup or footerCopyright
  // changelog — handled in scaffold.ts
};
