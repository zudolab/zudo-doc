// TOC section-label resolver for the scanner-visible Toc/MobileToc shims
// (zudolab/zudo-doc#2057). The host resolves @takazudo/zudo-doc as a workspace
// package, so it imports the real `getTocTitle` straight from the /toc barrel.
//
// The create-zudo-doc TEMPLATE counterpart
// (packages/create-zudo-doc/templates/base/pages/lib/_toc-title.ts) instead
// hand-mirrors this lang→title map, because scaffolded projects install the
// PUBLISHED @takazudo/zudo-doc (<= 0.2.2), which does not yet export
// `getTocTitle`. That deliberate divergence is allowlisted in
// .template-drift-allowlist; keep the two files behaviourally in sync until
// the template can switch to this import after the next package release.
export { getTocTitle } from "@takazudo/zudo-doc/toc";
