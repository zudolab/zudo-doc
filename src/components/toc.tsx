"use client";

// Scanner-visible Toc shim. zfb's island scanner does not register
// "use client" modules under node_modules (Takazudo/zudo-front-builder#999),
// so the package-internal default Toc island that DocLayoutWithDefaults
// renders emits a marker with no registry entry for published-package
// consumers — the TOC renders but never hydrates (active-heading highlight
// stays dead) on every doc page (zudolab/zudo-doc#2057). Same class as the
// ThemeToggle case fixed upstream in zudolab/zudo-doc#2048. This thin
// project-source wrapper gives the scanner a local binding to register;
// `pages/lib/_doc-page-shell.tsx` mounts it via `tocOverride`. Heals
// natively once zfb#1001 ships and node_modules "use client" modules are
// scanned again.
import type { JSX } from "preact";
import { Toc as ZudoDocToc, type TocProps } from "@takazudo/zudo-doc/toc";

export function Toc(props: TocProps): JSX.Element {
  return <ZudoDocToc {...props} />;
}
Toc.displayName = "Toc";

export type { TocProps };

export default Toc;
