"use client";

/** @jsxRuntime automatic */
import { getScope } from "@takazudo/zfb/zudo-react";
import { buildDesignTokenPanelConfig } from "./design-token-panel-config/index.js";
import { runDesignTokenPanelBootstrapOnce } from "./design-token-panel-bootstrap-controller.js";

/** Package-default island; zdtp owns the opaque Preact UI it mounts. */
export function DesignTokenPanelBootstrap(): null {
  const scope = getScope();
  scope.onActivate(() => {
    runDesignTokenPanelBootstrapOnce(
      buildDesignTokenPanelConfig,
      "default",
      scope.abortSignal,
    );
  });
  return null;
}

DesignTokenPanelBootstrap.displayName = "DesignTokenPanelBootstrap";
