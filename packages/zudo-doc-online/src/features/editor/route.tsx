// Labeled placeholder pane for the #/editor/:pageId route. Route-file
// ownership contract (epic #3327): the editor chrome / CodeMirror pane
// sub-issues (#3334 / #3336) replace ONLY this file — never
// src/app/routes.tsx or router.ts.
export interface EditorRouteProps {
  pageId: string;
}

export default function EditorRoute({ pageId }: EditorRouteProps) {
  return (
    <section className="p-hsp-xl">
      <h1 className="text-heading font-semibold">Editor</h1>
      <p className="mt-vsp-xs text-body text-muted">
        Placeholder pane for{" "}
        <code className="rounded-sm bg-code-bg px-hsp-xs text-code-fg">{pageId}</code>{" "}
        — the tabbed workspace + CodeMirror pane land in sub-issues #3334 /
        #3336.
      </p>
    </section>
  );
}
