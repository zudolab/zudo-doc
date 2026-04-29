// Shared MDX-component bag used by every doc-route page that renders
// `<entry.Content components={...} />`.
//
// ## Why a shared helper
//
// Pre-S4e the page-side `components` map only carried `htmlOverrides` plus
// `HtmlPreview`, because the zfb content bridge wasn't installed and every
// `<entry.Content>` call took the raw-markdown `<pre data-zfb-content-fallback>`
// path. Now that the bridge IS installed (zudo-doc#506), the compiled
// MDXContent functions fire for every entry — and the MDX emitter wraps
// every named-tag access with:
//
//   const CategoryNav2 = _components.CategoryNav ?? components.CategoryNav;
//   if (!CategoryNav2) throw new Error("MDX requires `CategoryNav` to be passed via the `components` prop");
//
// So any tag the MDX corpus uses but the page omits → 500 at render time.
//
// ## Strategy
//
// Until each named tag has its proper Preact binding ported to `@zudo-doc/zudo-doc-v2`,
// this module ships **stub bindings** that render nothing. That keeps the
// build green and the typography/Island acceptance tests intact while the
// proper bindings ship in sibling topics. As real components land, they
// replace their stub here and propagate to every page automatically.
//
// `htmlOverrides` (basic typography — h2/h3/h4/p/a/ul/ol/blockquote/strong/table)
// and `HtmlPreview: HtmlPreviewWrapper` (Island wrapper) stay in their
// non-stub form because their Preact bindings already exist.

import { htmlOverrides } from "@zudo-doc/zudo-doc-v2/content";
import { HtmlPreviewWrapper } from "@zudo-doc/zudo-doc-v2/html-preview-wrapper";

/**
 * MDX-tag stub: renders nothing. Returning `null` keeps the rendered
 * tree intact (Preact's null-vnode path) without leaking placeholder
 * markup into the SSR output.
 */
const MdxStub = (_props: unknown) => null;

/**
 * Build an admonition stub for the given variant — renders the
 * children inside `<div class="admonition admonition-<variant>">`
 * so the body text stays visible until the proper Preact bindings
 * land. Matches the `admonition` class hook the design system already
 * targets for the Astro-era components.
 *
 * Untyped (`unknown` props) on purpose: the stubs go away once the
 * proper bindings ship, so investing in a typed prop bag here would
 * just be deleted later.
 */
function makeAdmonitionStub(variant: string) {
  // The tag name is passed through `h` indirectly by the MDX runtime
  // (Preact's `h(tag, props, ...children)`), so we build a plain
  // VNode-shaped object here. Returning a real Preact vnode via
  // `h("div", ...)` would require pulling in `preact` at the call
  // site; the literal-shape is what htmlOverrides downstream emit
  // and it round-trips through `preact-render-to-string` cleanly.
  return function AdmonitionStub(props: { title?: string; children?: unknown }): unknown {
    return {
      type: "div",
      props: {
        class: `admonition admonition-${variant}`,
        children: [
          props.title ? { type: "div", props: { class: "admonition-title", children: props.title }, key: null, constructor: undefined } : null,
          { type: "div", props: { class: "admonition-body", children: props.children }, key: null, constructor: undefined },
        ],
      },
      key: null,
      constructor: undefined,
    };
  };
}

/**
 * Components map handed to `<entry.Content components={...} />`. Combines:
 *
 * - `htmlOverrides` — element-level overrides for native tags (h2..h4,
 *   p, a, ul/ol, blockquote, strong, table). Defined in
 *   `@zudo-doc/zudo-doc-v2/content`.
 * - `HtmlPreview` — Island-wrapped preview component
 *   (`HtmlPreviewWrapper` from `@zudo-doc/zudo-doc-v2/html-preview-wrapper`).
 * - Stub bindings for every other custom tag the MDX corpus references.
 *   Each stub returns `null`. This list is the union of `<TagName` matches
 *   under `src/content/docs/` and `src/content/docs-ja/` minus the bindings
 *   above.
 *
 * Keep this list in sync with the corpus when new MDX tags appear.
 * `pnpm exec grep -rohE '<[A-Z][a-zA-Z]+' src/content/` enumerates them.
 */
export const mdxComponents = {
  ...htmlOverrides,
  HtmlPreview: HtmlPreviewWrapper,
  // Admonitions — proper bindings land in the doc-content-components
  // topic. Until then, render the children inside a
  // `<div class="admonition admonition-<variant>">` so the body text
  // stays visible (and the design system's existing `.admonition` CSS
  // hook still targets it).
  Note: makeAdmonitionStub("note"),
  Tip: makeAdmonitionStub("tip"),
  Info: makeAdmonitionStub("info"),
  Warning: makeAdmonitionStub("warning"),
  Danger: makeAdmonitionStub("danger"),
  // Showcase / nav helpers.
  CategoryNav: MdxStub,
  CategoryTreeNav: MdxStub,
  SiteTreeNav: MdxStub,
  SiteTreeNavDemo: MdxStub,
  Details: MdxStub,
  Tabs: MdxStub,
  TabItem: MdxStub,
  SmartBreak: MdxStub,
  Island: MdxStub,
  PresetGenerator: MdxStub,
  // Pure showcase placeholders (Avatar/Button/Card/MyComponent/PageLayout
  // appear only inside MDX prose as illustrative examples — never
  // implemented as real components).
  Avatar: MdxStub,
  Button: MdxStub,
  Card: MdxStub,
  MyComponent: MdxStub,
  PageLayout: MdxStub,
};
