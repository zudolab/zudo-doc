// W6A stub — no-op default export.
//
// When the sidebarToggle feature is enabled, the feature template
// overwrites this file with the real desktop sidebar-toggle island.
// Generated projects without the feature ship the no-op so the
// unconditional `pages/lib/_body-end-islands` (or sidebar wrapper)
// import resolves at typecheck time.
import type { JSX } from "preact";

function DesktopSidebarToggle(): JSX.Element | null {
  return null;
}
DesktopSidebarToggle.displayName = "DesktopSidebarToggle";

export default DesktopSidebarToggle;
