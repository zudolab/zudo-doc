// doc-history's ONLY route to the optional `diff` peer (#4652, mirroring the
// #4651 katex-loader). The DocHistory island imports THIS subpath by its bare
// package name rather than `diff` directly, so that when `docHistory` is off
// the preset's `diff-loader` plugin can shadow exactly this specifier with a
// throwing virtual module — the bundle then never asks the bundler to resolve
// an absent `diff`, which Rolldown otherwise reports as an `UNRESOLVED_IMPORT`
// warning on every docHistory-off build. Shadowing the bare `diff` instead
// would hijack a host's own diff imports.
//
// The load stays a rejection-handled DYNAMIC import, never a static
// `export … from "diff"`: with `docHistory: true` and diff not installed, a
// static edge here would be a build-fatal unresolved dependency that no catch
// in the importer can intercept.

export type DiffLines = typeof import("diff").diffLines;

// diff ships ESM (named exports) and CJS builds; interop can surface the API
// on the namespace, on `default`, or doubly wrapped — take whichever has it.
function pickDiffLines(m: unknown): DiffLines | null {
  let cur: unknown = m;
  for (let i = 0; i < 3 && cur && typeof cur === "object"; i++) {
    const fn = (cur as { diffLines?: unknown }).diffLines;
    if (typeof fn === "function") return fn as DiffLines;
    cur = (cur as { default?: unknown }).default;
  }
  return null;
}

/** diff's `diffLines`, or `null` when the optional peer is not installed. */
export const diffLines: DiffLines | null = await import("diff").then(pickDiffLines, () => null);
