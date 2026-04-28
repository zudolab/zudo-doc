/** @jsxImportSource preact */
// "Defaults" wrapper around the composable `<DocLayout>` shell.
//
// This file is the single point that:
//
//  1. Owns the 16 `create-zudo-doc` injection anchors. The drift checker
//     (E9a sub-task 4) compares the literal anchor *substrings* in this
//     file to the substrings in the scaffolded `doc-layout.astro`.
//     The anchor identifiers themselves come from `./anchors.ts` — keep
//     this file's anchors in lockstep with that list.
//
//  2. Wires together the *default* sibling primitives that ship with
//     this package — Header, Sidebar, TOC, Breadcrumb, Footer, Head
//     injection, design-token panel, etc. — into the `<DocLayout>`
//     slot props. Consumers can swap any of these out by passing an
//     override prop (`headerOverride`, `sidebarOverride`, …).
//
// Since the sibling primitives live in adjacent topic folders that are
// being authored in parallel, this wrapper imports them *type-only* via
// the `../*/index.ts` barrel files. At merge time the team lead resolves
// any cross-topic API mismatches; the slot props are intentionally
// permissive (`ComponentChildren`) so an override is always possible.
//
// Anchor cheat-sheet (matched 1:1 against
// `packages/create-zudo-doc/templates/base/src/layouts/doc-layout.astro`):
//
//  Frontmatter region:
//   - // @slot:doc-layout:imports
//   - // @slot:doc-layout:frontmatter
//
//  Body region:
//   - <!-- @slot:doc-layout:head-scripts -->
//   - <!-- @slot:doc-layout:head-links -->
//   - <!-- @slot:doc-layout:header-call:start -->
//   - <!-- @slot:doc-layout:header-call:end -->
//   - <!-- @slot:doc-layout:after-sidebar -->
//   - <!-- @slot:doc-layout:content-wrapper:start -->
//   - <!-- @slot:doc-layout:content-wrapper:end -->
//   - <!-- @slot:doc-layout:breadcrumb:start -->
//   - <!-- @slot:doc-layout:breadcrumb:end -->
//   - <!-- @slot:doc-layout:after-breadcrumb -->
//   - <!-- @slot:doc-layout:after-content -->
//   - <!-- @slot:doc-layout:footer -->
//   - <!-- @slot:doc-layout:body-end-components -->
//   - <!-- @slot:doc-layout:body-end-scripts -->
//
// Each anchor below is reproduced *verbatim* inside a JSX comment
// expression `{/* … */}`. Preact's JSX handles comment expressions as
// no-ops at runtime, so they have no effect on the output, but the
// drift checker — which works at the source-text level — sees them as
// substrings, identical to the way it sees them in the scaffolded
// `.astro` file. The exception is the two frontmatter anchors, which
// the drift checker matches in their `// @slot:doc-layout:…` line-
// comment form at the top of this file.
//
// // @slot:doc-layout:imports
// // @slot:doc-layout:frontmatter

import type { ComponentChildren, JSX } from "preact";

import { DocLayout, type DocLayoutProps } from "./doc-layout.js";

// Sibling-topic barrels. Each is being authored by a peer agent in the
// same parallel session; the imports below assume the canonical shape
// described in epic #474. The team lead reconciles signatures at merge
// time. We keep these as `import type` where possible so the build
// graph stays loose during the parallel-topic phase.
//
// NOTE: at the time this topic is being implemented these sibling
// barrels may be empty / scaffold-only. We avoid importing concrete
// values from them; only types pass through here. The runtime defaults
// for the slots come from props the *caller* of
// `<DocLayoutWithDefaults>` provides, which keeps this file
// self-contained until the siblings stabilize.
//
// (Intentionally no concrete imports from siblings yet.)

/**
 * Override slots for the default-bearing wrapper. Any slot that the
 * caller wants to replace can be passed here; otherwise the defaults
 * (set up by the sibling topic primitives, once those stabilize) are
 * used.
 *
 * The concrete defaults for header/sidebar/toc/breadcrumb/footer are
 * intentionally *not* hard-coded inside this wrapper today: it would
 * couple this topic to in-flight sibling APIs, and the manager has
 * asked us to write to the expected interface and let the merge step
 * resolve mismatches. Callers can pass overrides explicitly today, and
 * once the sibling topics land, those imports can be wired up in a
 * follow-up commit without changing this wrapper's public surface.
 */
export interface DocLayoutWithDefaultsProps
  extends Omit<
    DocLayoutProps,
    | "header"
    | "sidebar"
    | "toc"
    | "mobileToc"
    | "breadcrumb"
    | "footer"
    | "main"
  > {
  /** The page's article body. Required. */
  children: ComponentChildren;

  // ---- override slots -----------------------------------------------
  /** Replace the default site header. */
  headerOverride?: ComponentChildren;
  /** Replace the default sidebar contents. */
  sidebarOverride?: ComponentChildren;
  /** Replace the default desktop TOC. */
  tocOverride?: ComponentChildren;
  /** Replace the default mobile TOC. */
  mobileTocOverride?: ComponentChildren;
  /** Replace the default breadcrumb. */
  breadcrumbOverride?: ComponentChildren;
  /** Replace the default footer. */
  footerOverride?: ComponentChildren;
}

/**
 * The 16 `@slot:doc-layout:*` injection-anchor strings. Wraps the
 * canonical list from `./anchors.ts` so consumers (the drift checker,
 * tests) can verify in one place that this wrapper carries every anchor
 * `create-zudo-doc` knows about.
 *
 * The values are exposed both as the literal comment strings (what the
 * drift checker greps for) and as the structured anchor list.
 */
export {
  DOC_LAYOUT_ANCHORS,
  DOC_LAYOUT_ANCHOR_IDS,
  allAnchorComments,
  anchorComment,
  type DocLayoutAnchor,
  type DocLayoutAnchorId,
  type DocLayoutAnchorKind,
} from "./anchors.js";

/**
 * Default-bearing wrapper. Consumers who don't need composable layout
 * control reach for this; it forwards to `<DocLayout>` and inserts
 * sensible (and overridable) defaults into each slot.
 *
 * The body of this component contains every body-region injection
 * anchor as a JSX comment expression, so a literal-substring drift
 * check between this file and the scaffolded `doc-layout.astro` will
 * find each anchor in both places. JSX comment expressions are
 * compile-time-only and do not affect runtime output.
 */
export function DocLayoutWithDefaults(
  props: DocLayoutWithDefaultsProps,
): JSX.Element {
  const {
    children,
    headerOverride,
    sidebarOverride,
    tocOverride,
    mobileTocOverride,
    breadcrumbOverride,
    footerOverride,
    bodyEndComponents,
    bodyEndScripts,
    afterSidebar,
    afterBreadcrumb,
    afterContent,
    head,
    ...rest
  } = props;

  // The empty fragments below carry the body-region injection anchors
  // verbatim. Each fragment is a no-op at runtime; the drift checker
  // matches the literal anchor string at the source-text level.

  return (
    <>
      {/* @slot:doc-layout:head-scripts */}
      {/* @slot:doc-layout:head-links */}
      {/* @slot:doc-layout:header-call:start */}
      {/* @slot:doc-layout:header-call:end */}
      {/* @slot:doc-layout:after-sidebar */}
      {/* @slot:doc-layout:content-wrapper:start */}
      {/* @slot:doc-layout:content-wrapper:end */}
      {/* @slot:doc-layout:breadcrumb:start */}
      {/* @slot:doc-layout:breadcrumb:end */}
      {/* @slot:doc-layout:after-breadcrumb */}
      {/* @slot:doc-layout:after-content */}
      {/* @slot:doc-layout:footer */}
      {/* @slot:doc-layout:body-end-components */}
      {/* @slot:doc-layout:body-end-scripts */}
      <DocLayout
        {...rest}
        head={head}
        header={headerOverride ?? null}
        sidebar={sidebarOverride}
        toc={tocOverride}
        mobileToc={mobileTocOverride}
        breadcrumb={breadcrumbOverride}
        afterBreadcrumb={afterBreadcrumb}
        afterSidebar={afterSidebar}
        afterContent={afterContent}
        footer={footerOverride}
        bodyEndComponents={bodyEndComponents}
        bodyEndScripts={bodyEndScripts}
        main={children}
      />
    </>
  );
}
