/**
 * Production bootstrap for @takazudo/zdtp (zdtp).
 *
 * Imported as a side-effect from the body-end islands helper when
 * settings.designTokenPanel is truthy. The dynamic import is gated there so
 * this module is only bundled when the feature is enabled.
 *
 * The wiring MECHANISM (configurePanel + setLifecycleAdapter) now lives in the
 * package at `@takazudo/zudo-doc/design-token-panel-bootstrap`. This file
 * passes the project's PanelConfig DATA to that mechanism.
 *
 * S9a package-first migration — zudolab/zudo-doc#2333.
 *
 * CSS is pulled via `@import "@takazudo/zdtp/styles.css"` in
 * src/styles/global.css so the panel chrome lands in the main page CSS bundle
 * (not a deferred chunk). Vite library mode strips the source CSS import from
 * the emitted JS, so the explicit CSS-side import is the required pull point.
 */

import { bootstrapDesignTokenPanel } from "@takazudo/zudo-doc/design-token-panel-bootstrap";
import { designTokenPanelConfig } from "@/config/design-token-panel-config";

bootstrapDesignTokenPanel(designTokenPanelConfig);
