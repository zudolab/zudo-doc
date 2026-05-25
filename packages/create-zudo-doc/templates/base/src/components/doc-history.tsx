// W6A stub — no-op default + DocHistory named exports.
//
// When the docHistory feature is enabled, the feature template
// overwrites this file with the real island. Generated projects
// without the feature ship the no-op so the unconditional
// `pages/lib/_doc-history-area` import resolves. The host module also
// exposes `DocHistory` as a named export, so the stub mirrors both
// shapes to keep the import surface stable.
import type { JSX } from "preact";

function DocHistoryComponent(): JSX.Element | null {
  return null;
}
DocHistoryComponent.displayName = "DocHistory";

export default DocHistoryComponent;

export const DocHistory = DocHistoryComponent;
