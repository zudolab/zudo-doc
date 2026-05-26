// postMessage bridge between the Design Token Tweak Panel host page and the
// preview iframe it controls. The panel UI mutates a structured set of CSS
// variables and ships an `apply-css-vars` payload over postMessage; the
// iframe receives it and writes the values onto its own
// `documentElement.style`. This decouples token edits from the host page so
// the panel can be embedded into any layout without leaking style mutations
// up into surrounding chrome.
//
// Protocol
// --------
//
//   panel → iframe :  { type: "apply-css-vars", vars: [["--zd-bg", "#000"], ...] }
//   panel → iframe :  { type: "clear-css-vars", names: ["--zd-bg", ...] }
//   iframe → panel :  { type: "ready" }            // sent on iframe load
//   iframe → panel :  { type: "error", reason }    // optional diagnostics
//
// All messages carry a `source: "zudo-doc-theme-bridge"` discriminator so a
// host page hosting other postMessage protocols can ignore foreign traffic.

export const BRIDGE_SOURCE = "zudo-doc-theme-bridge" as const;

export type CssVarPair = readonly [name: string, value: string];

export interface ApplyCssVarsMessage {
  source: typeof BRIDGE_SOURCE;
  type: "apply-css-vars";
  vars: ReadonlyArray<CssVarPair>;
}

export interface ClearCssVarsMessage {
  source: typeof BRIDGE_SOURCE;
  type: "clear-css-vars";
  names: ReadonlyArray<string>;
}

export interface ReadyMessage {
  source: typeof BRIDGE_SOURCE;
  type: "ready";
}

export interface ErrorMessage {
  source: typeof BRIDGE_SOURCE;
  type: "error";
  reason: string;
}

export type BridgeMessage =
  | ApplyCssVarsMessage
  | ClearCssVarsMessage
  | ReadyMessage
  | ErrorMessage;

/**
 * Type guard. Accepts any postMessage payload and confirms it is a bridge
 * envelope. Foreign messages are ignored silently.
 */
export function isBridgeMessage(value: unknown): value is BridgeMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as { source?: unknown; type?: unknown };
  return v.source === BRIDGE_SOURCE && typeof v.type === "string";
}

// --- Sender (panel → iframe) -----------------------------------------------

/** Send `apply-css-vars` to the iframe. No-op when the iframe has not loaded. */
export function sendApplyCssVars(
  iframe: HTMLIFrameElement | null,
  vars: ReadonlyArray<CssVarPair>,
): void {
  const win = iframe?.contentWindow;
  if (!win) return;
  const message: ApplyCssVarsMessage = {
    source: BRIDGE_SOURCE,
    type: "apply-css-vars",
    vars,
  };
  // targetOrigin "*" because the iframe is same-origin (sandboxed via srcdoc
  // or a sibling URL). If a future caller embeds a cross-origin preview they
  // can pass a stricter origin via a wrapping helper.
  win.postMessage(message, "*");
}

/** Send `clear-css-vars` to the iframe so it removes inline overrides. */
export function sendClearCssVars(
  iframe: HTMLIFrameElement | null,
  names: ReadonlyArray<string>,
): void {
  const win = iframe?.contentWindow;
  if (!win) return;
  const message: ClearCssVarsMessage = {
    source: BRIDGE_SOURCE,
    type: "clear-css-vars",
    names,
  };
  win.postMessage(message, "*");
}

// --- Receiver (iframe-side) -------------------------------------------------

/**
 * Install a message listener inside the preview iframe document that applies
 * any incoming CSS-var batches onto `documentElement.style`. Returns a
 * teardown function. Intended to be called once at iframe boot.
 */
export function installIframeReceiver(target: Window = window): () => void {
  function handler(event: MessageEvent): void {
    const data = event.data;
    if (!isBridgeMessage(data)) return;
    if (data.type === "apply-css-vars") {
      const root = target.document.documentElement;
      for (const [name, value] of data.vars) {
        root.style.setProperty(name, value);
      }
      return;
    }
    if (data.type === "clear-css-vars") {
      const root = target.document.documentElement;
      for (const name of data.names) {
        root.style.removeProperty(name);
      }
      return;
    }
  }
  target.addEventListener("message", handler);
  // Announce readiness so the panel can start streaming initial state.
  const parent = target.parent;
  if (parent && parent !== target) {
    const ready: ReadyMessage = { source: BRIDGE_SOURCE, type: "ready" };
    parent.postMessage(ready, "*");
  }
  return () => target.removeEventListener("message", handler);
}

/**
 * Install a `ready` listener on the panel side so callers can defer the
 * initial CSS-var sync until the iframe document has booted.
 */
export function onIframeReady(
  expectedSource: Window | null,
  callback: () => void,
): () => void {
  function handler(event: MessageEvent): void {
    if (expectedSource && event.source !== expectedSource) return;
    if (!isBridgeMessage(event.data)) return;
    if (event.data.type === "ready") callback();
  }
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}
