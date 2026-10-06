/** @jsxRuntime automatic */
import { MERMAID_ENLARGE_DIALOG_CLASS, ENLARGE_DIALOG_STYLE } from "../island-types/index.js";

/** Closed dialog shell rendered before island activation. */
export function MermaidEnlargeSsrFallback() {
  return <dialog aria-label="Enlarged diagram" class={MERMAID_ENLARGE_DIALOG_CLASS} style={ENLARGE_DIALOG_STYLE} />;
}
