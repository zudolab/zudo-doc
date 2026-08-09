// The #/popped-out/preview/:pageId route: mounts the pop-out window's own
// SPA instance (popout-window.tsx).
//
// Route-file ownership contract (epic #3327): this file replaces ONLY the
// pop-out feature's own stub — src/app/routes.tsx and router.ts stay the
// shell's.
//
// Mounted WITHOUT the shell (main.tsx branches on the popped-out prefix
// before mounting the shell), so this pane owns its own full-page
// background/foreground tokens rather than inheriting the shell's. This
// file itself stays a trivial pass-through — pageId validation and every
// error/loading/ready state live in popout-window.tsx, the single place
// that owns them.
import PopoutWindow from "./popout-window";

export interface PopoutRouteProps {
  pageId: string;
}

export default function PopoutRoute({ pageId }: PopoutRouteProps) {
  return <PopoutWindow pageId={pageId} />;
}
