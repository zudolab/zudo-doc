"use client";

// Side-effect import — running this module in the browser triggers
// configurePanel(designTokenPanelConfig) which mounts the zdtp panel
// and registers the `toggle-design-token-panel` window listener.
import "@/lib/design-token-panel-bootstrap";

import type { JSX } from "preact";

function DesignTokenPanelBootstrap(): JSX.Element | null {
  return null;
}
DesignTokenPanelBootstrap.displayName = "DesignTokenPanelBootstrap";

export default DesignTokenPanelBootstrap;
