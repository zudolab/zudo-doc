// Single source of truth for the 16 doc-layout injection anchors that
// `create-zudo-doc` (the scaffold tool) injects into when generating
// downstream projects. These ids are what the drift checker (E9a sub-task
// 4) compares between this package's `DocLayoutWithDefaults` and the
// scaffolded `doc-layout.astro` to catch missing or renamed anchors.
//
// The anchor *string* (the literal text the drift checker greps for in
// the scaffolded file) is computed by `anchorComment(id)` below — it
// produces an HTML comment for body-side anchors and a line comment for
// frontmatter-side anchors. A scaffolded doc-layout will contain one
// occurrence of each anchor in the same form `create-zudo-doc` already
// uses today (see `packages/create-zudo-doc/templates/base/src/layouts/
// doc-layout.astro`).
//
// Adding or removing an anchor here is the contract change — keep this
// list in lockstep with the create-zudo-doc feature modules under
// `packages/create-zudo-doc/src/features/*.ts`.

/**
 * Anchor identifier — the unique fragment after `@slot:doc-layout:` in
 * the literal anchor text. This is the stable key the drift checker keys
 * off of; the surrounding comment syntax is derived from `kind`.
 */
export type DocLayoutAnchorId =
  | "imports"
  | "frontmatter"
  | "head-scripts"
  | "head-links"
  | "header-call:start"
  | "header-call:end"
  | "after-sidebar"
  | "content-wrapper:start"
  | "content-wrapper:end"
  | "breadcrumb:start"
  | "breadcrumb:end"
  | "after-breadcrumb"
  | "after-content"
  | "footer"
  | "body-end-components"
  | "body-end-scripts";

/**
 * Whether the anchor lives in the frontmatter region (`---` block in
 * Astro / module-scope in JSX) or in the body markup region.
 *
 * - `frontmatter` anchors are emitted as `// @slot:doc-layout:<id>` line
 *   comments — both Astro frontmatter and TS module scope accept them.
 * - `body` anchors are emitted as `<!-- @slot:doc-layout:<id> -->` HTML
 *   comments — JSX accepts these as `{/* … *\/}` blocks (we keep the
 *   literal HTML form for byte-for-byte parity with the existing
 *   create-zudo-doc anchor strings).
 */
export type DocLayoutAnchorKind = "frontmatter" | "body";

export interface DocLayoutAnchor {
  readonly id: DocLayoutAnchorId;
  readonly kind: DocLayoutAnchorKind;
}

/**
 * The 16 doc-layout anchors, in the order they appear in a scaffolded
 * `doc-layout.astro`. Order is informational (useful for the drift
 * checker's diagnostic output); identity is what matters.
 */
export const DOC_LAYOUT_ANCHORS: readonly DocLayoutAnchor[] = [
  { id: "imports", kind: "frontmatter" },
  { id: "frontmatter", kind: "frontmatter" },
  { id: "head-scripts", kind: "body" },
  { id: "head-links", kind: "body" },
  { id: "header-call:start", kind: "body" },
  { id: "header-call:end", kind: "body" },
  { id: "after-sidebar", kind: "body" },
  { id: "content-wrapper:start", kind: "body" },
  { id: "content-wrapper:end", kind: "body" },
  { id: "breadcrumb:start", kind: "body" },
  { id: "breadcrumb:end", kind: "body" },
  { id: "after-breadcrumb", kind: "body" },
  { id: "after-content", kind: "body" },
  { id: "footer", kind: "body" },
  { id: "body-end-components", kind: "body" },
  { id: "body-end-scripts", kind: "body" },
] as const;

/** Sanity check at module load: the count is the contract. */
const EXPECTED_ANCHOR_COUNT = 16;
if (DOC_LAYOUT_ANCHORS.length !== EXPECTED_ANCHOR_COUNT) {
  throw new Error(
    `DOC_LAYOUT_ANCHORS must have exactly ${EXPECTED_ANCHOR_COUNT} entries, got ${DOC_LAYOUT_ANCHORS.length}`,
  );
}

/**
 * Build the literal anchor *comment string* the drift checker greps for
 * in a scaffolded file.
 *
 * - `frontmatter` → `// @slot:doc-layout:<id>`
 * - `body`        → `<!-- @slot:doc-layout:<id> -->`
 *
 * Examples:
 *   anchorComment({ id: "imports", kind: "frontmatter" })
 *     // "// @slot:doc-layout:imports"
 *   anchorComment({ id: "footer", kind: "body" })
 *     // "<!-- @slot:doc-layout:footer -->"
 */
export function anchorComment(anchor: DocLayoutAnchor): string {
  if (anchor.kind === "frontmatter") {
    return `// @slot:doc-layout:${anchor.id}`;
  }
  return `<!-- @slot:doc-layout:${anchor.id} -->`;
}

/**
 * Convenience: every anchor's comment string, in declaration order. The
 * drift checker can iterate this and assert each substring appears in the
 * scaffolded `doc-layout.astro`.
 */
export function allAnchorComments(): readonly string[] {
  return DOC_LAYOUT_ANCHORS.map(anchorComment);
}

/**
 * Convenience: anchor IDs as a typed set. Useful when a caller wants to
 * verify "is this id one of ours?" without scanning the full list.
 */
export const DOC_LAYOUT_ANCHOR_IDS: ReadonlySet<DocLayoutAnchorId> = new Set(
  DOC_LAYOUT_ANCHORS.map((a) => a.id),
);
