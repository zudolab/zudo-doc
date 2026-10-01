import type { Child, Component, Diagnostic, IslandIdentity } from "@takazudo/zfb/zudo-react";
import { h } from "@takazudo/zfb/zudo-react";
import { islandRoot, renderToString } from "@takazudo/zfb/zudo-react/server";
import type { RootHandle } from "@takazudo/zfb/zudo-react/client";

export function renderSsr(node: Child): string {
  return renderToString(node);
}

/** Drain zudo-react's commit/effect queue, including work queued by effects. */
export async function flushAll(): Promise<void> {
  const { flush } = await import("@takazudo/zfb/zudo-react");
  await flush();
  await Promise.resolve();
  await flush();
}

export async function renderIsland<P>(
  Component: Component<P>,
  props: P,
  options: {
    identity: IslandIdentity;
    mode?: "hydrate" | "mount";
    beforeActivate?: (root: HTMLElement) => void;
  },
): Promise<{
  container: HTMLElement;
  root: HTMLElement;
  handle: RootHandle | null;
  diagnostics: Diagnostic[];
  dispose: () => void;
}> {
  if (typeof document === "undefined") {
    throw new Error("renderIsland requires a DOM (use @vitest-environment happy-dom)");
  }
  // The test environment installs DOM globals before this dynamic client import.
  const { hydrate, mount } = await import("@takazudo/zfb/zudo-react/client");
  const diagnostics: Diagnostic[] = [];
  const host = document.createElement("div");
  const mode = options.mode ?? "hydrate";
  host.innerHTML = renderToString(
    islandRoot(h(Component, props as Record<string, unknown>), {
      identity: options.identity,
      skipSsr: mode === "mount",
    }),
  );
  document.body.append(host);
  const root = host.firstElementChild as HTMLElement | null;
  if (!root) {
    host.remove();
    throw new Error("islandRoot did not render a root element");
  }
  options.beforeActivate?.(root);
  const node = h(Component, props as Record<string, unknown>);
  const handle = (mode === "mount" ? mount : hydrate)(node, root, {
    identity: options.identity,
    report: (value) => diagnostics.push(value),
  });
  await flushAll();
  return {
    container: host,
    root,
    handle,
    diagnostics,
    dispose: () => {
      handle?.dispose();
      host.remove();
    },
  };
}
