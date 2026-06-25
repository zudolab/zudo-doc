// W6A stub — no-op default + DocHistory named exports.
//
// The real DocHistory island now ships from the package
// (`@takazudo/zudo-doc/doc-history`); the unconditional
// `pages/lib/_doc-history-area.tsx` imports it directly from there. When
// the docHistory feature is enabled the feature template overwrites this
// file with a re-export shim pointing at the package island. Generated
// projects without the feature ship this no-op so any project-local code
// that references the `@/components/doc-history` path still resolves. The
// host module exposes `DocHistory` as a named export, so the stub mirrors
// both the default and named shapes to keep the import surface stable.
import type { JSX } from "preact";

function DocHistoryComponent(): JSX.Element | null {
  return null;
}
DocHistoryComponent.displayName = "DocHistory";

export default DocHistoryComponent;

export const DocHistory = DocHistoryComponent;
