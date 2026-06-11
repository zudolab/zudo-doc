"use client";

// Scanner-visible MobileToc shim — same rationale as `toc.tsx`: zfb's island
// scanner skips "use client" modules under node_modules
// (Takazudo/zudo-front-builder#999), so the package-internal default
// MobileToc island never hydrates for published-package consumers
// (zudolab/zudo-doc#2057). `pages/lib/_doc-page-shell.tsx` mounts this via
// `mobileTocOverride`.
import type { JSX } from "preact";
import {
  MobileToc as ZudoDocMobileToc,
  type MobileTocProps,
} from "@takazudo/zudo-doc/toc";

export function MobileToc(props: MobileTocProps): JSX.Element {
  return <ZudoDocMobileToc {...props} />;
}
MobileToc.displayName = "MobileToc";

export type { MobileTocProps };

export default MobileToc;
