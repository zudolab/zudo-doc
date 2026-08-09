// Labeled placeholder pane for the #/outline route. Route-file ownership
// contract (epic #3327): the outline surface sub-issue (#3335) replaces
// ONLY this file — never src/app/routes.tsx or router.ts.
export default function OutlineRoute() {
  return (
    <section className="p-hsp-xl">
      <h1 className="text-heading font-semibold">Outline</h1>
      <p className="mt-vsp-xs text-body text-muted">
        Placeholder pane — the indented tree + board-view switcher land in
        sub-issue #3335.
      </p>
    </section>
  );
}
