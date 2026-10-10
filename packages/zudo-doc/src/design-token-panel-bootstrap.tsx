/**
 * Public facade for the design-token-panel bootstrap subpath. Callable setup
 * helpers live in the ordinary controller module; the sole island marker is
 * defined in its own `use client` entry.
 */
export * from "./design-token-panel-bootstrap-controller.js";
export { DesignTokenPanelBootstrap } from "./design-token-panel-bootstrap-island.js";
