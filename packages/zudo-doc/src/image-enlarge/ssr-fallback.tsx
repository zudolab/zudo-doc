/** @jsxRuntime automatic */
import { IMAGE_ENLARGE_DIALOG_CLASS, ENLARGE_DIALOG_STYLE } from "../island-types/index.js";

/** Closed dialog shell rendered before island activation. */
export function ImageEnlargeSsrFallback() {
  return <dialog class={IMAGE_ENLARGE_DIALOG_CLASS} style={ENLARGE_DIALOG_STYLE} />;
}
