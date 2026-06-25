// W6A stub — no-op default + ImageEnlarge / ImageEnlargeSsrFallback exports.
//
// The real ImageEnlarge island and its SSR fallback now ship from the
// package (`@takazudo/zudo-doc/image-enlarge`); the unconditional
// `pages/lib/_body-end-islands.tsx` imports them directly from there. When
// the imageEnlarge feature is enabled the feature template overwrites this
// file with a re-export shim pointing at the package island. Generated
// projects without the feature ship this no-op so any project-local code
// that references the `@/components/image-enlarge` path still resolves (the
// body-end renderer references both the default and the SSR fallback).
import type { JSX } from "preact";

function ImageEnlarge(): JSX.Element | null {
  return null;
}
ImageEnlarge.displayName = "ImageEnlarge";

export default ImageEnlarge;

export { ImageEnlarge };

export function ImageEnlargeSsrFallback(): JSX.Element | null {
  return null;
}
