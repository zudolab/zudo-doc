/**
 * Production bootstrap for @takazudo/zdtp (zdtp).
 *
 * Imported as a side-effect from _body-end-islands.tsx when
 * settings.designTokenPanel is truthy. The dynamic import is gated there so
 * this module is only bundled when the feature is enabled.
 *
 * The wiring MECHANISM (configurePanel + setLifecycleAdapter + the mode-scoped
 * reconfigure) lives in the package at
 * `@takazudo/zudo-doc/design-token-panel-bootstrap`. This file passes that
 * mechanism the PanelConfig DATA — the package-default builder from
 * `@takazudo/zudo-doc/design-token-panel-config` (the showcase used to keep a
 * byte-for-byte-mirrored copy of this builder at
 * `src/config/design-token-panel-config.ts`; that copy was dropped as
 * redundant, see #2682).
 *
 * We pass the `buildDesignTokenPanelConfig` BUILDER (not the plain
 * `designTokenPanelConfig` object) so the bootstrap rebuilds the panel per
 * light/dark mode on every `color-scheme-changed` toggle — keeping the Color
 * tab's semantic defaults mode-faithful (zudolab/zudo-doc#2610). Generated
 * projects on the old shape may still pass the plain config; the bootstrap
 * accepts both.
 *
 * S9a package-first migration — zudolab/zudo-doc#2333.
 *
 * CSS is pulled via `@import "@takazudo/zdtp/styles.css"` in
 * src/styles/global.css so the panel chrome lands in the main page CSS bundle
 * (not a deferred chunk). Vite library mode strips the source CSS import from
 * the emitted JS, so the explicit CSS-side import is the required pull point.
 * See @takazudo/zdtp PORTABLE-CONTRACT.md §7.
 */

import { bootstrapDesignTokenPanel } from "@takazudo/zudo-doc/design-token-panel-bootstrap";
import { buildDesignTokenPanelConfig } from "@takazudo/zudo-doc/design-token-panel-config";

bootstrapDesignTokenPanel(buildDesignTokenPanelConfig);
