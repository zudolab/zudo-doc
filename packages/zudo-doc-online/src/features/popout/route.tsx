// Labeled placeholder pane for the #/popped-out/preview/:pageId route.
// Route-file ownership contract (epic #3327): the pop-out window sub-issue
// (#3339) replaces ONLY this file — never src/app/routes.tsx or router.ts.
//
// Mounted WITHOUT the shell (main.tsx branches on the popped-out prefix
// before mounting the shell), so this pane owns its own full-page
// background/foreground tokens rather than inheriting the shell's.
export interface PopoutRouteProps {
  pageId: string;
}

export default function PopoutRoute({ pageId }: PopoutRouteProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-hsp-xl text-fg">
      <div className="text-center">
        <h1 className="text-heading font-semibold">Pop-out preview</h1>
        <p className="mt-vsp-xs text-body text-muted">
          Placeholder pane for{" "}
          <code className="rounded-sm bg-code-bg px-hsp-xs text-code-fg">{pageId}</code>{" "}
          — the pop-out preview window lands in sub-issue #3339.
        </p>
      </div>
    </div>
  );
}
