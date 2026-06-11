"use client";

// W6A stub — no-op default + ImageEnlargeSsrFallback named exports.
//
// When the imageEnlarge feature is enabled, the feature template
// overwrites this file with the real island and SSR fallback. Generated
// projects without the feature ship the no-op so the unconditional
// `pages/lib/_body-end-islands` import resolves (the body-end islands
// renderer references both the default and the SSR fallback).
import type { JSX } from "preact";

function ImageEnlarge(): JSX.Element | null {
  return null;
}
ImageEnlarge.displayName = "ImageEnlarge";

export default ImageEnlarge;

export function ImageEnlargeSsrFallback(): JSX.Element | null {
  return null;
}
