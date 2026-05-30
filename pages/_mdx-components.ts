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
// This module ships stub bindings for tags not yet ported to `@takazudo/zudo-doc`
// (render nothing), and real Preact bindings for tags whose ports are complete.
// As real components land, they replace their stub here and propagate to every page automatically.
//
// `htmlOverrides` (basic typography — h2/h3/h4/p/a/ul/ol/blockquote/strong/table)
// and `HtmlPreview: HtmlPreviewWrapper` (Island wrapper) stay in their
// non-stub form because their Preact bindings already exist.
//
// ## Locale-aware bindings (createMdxComponents factory)
//
// CategoryNav, CategoryTreeNav, SiteTreeNav, and SiteTreeNavDemo resolve nav
// tree data at render time. Since the same MDX content is rendered for both
// default-locale and non-default-locale pages, these components need to know
// which locale to use when building the nav tree.
//
// The `createMdxComponents(lang)` factory returns a components map with
// locale-bound wrappers for these nav components. Page modules should call it
// with the active locale instead of using the static `mdxComponents` export.
// The static export still exists for backward compatibility (using defaultLocale).
//
// ## Deferred: zfb next.16 global `mdx-components.tsx` convention
//
// zfb next.16 introduced a default-export `mdx-components.tsx` convention as
// the idiomatic place to register MDX overrides (alongside next.18's
// `defaultComponents` / `mergeMdxComponents`). zudo-doc consciously does NOT
// adopt it: `createMdxComponents(lang)` is locale-bound — the nav components
// above resolve their tree per-locale — and a single static default export
// cannot be locale-parameterized, so a per-call `components` map is required
// regardless. Revisit only if zfb makes the convention locale-aware.

import type { ComponentChildren } from "preact";
import { toChildArray } from "preact";
import type { VNode } from "preact";
import { htmlOverrides } from "@takazudo/zudo-doc/content";
import { HtmlPreviewWrapper } from "@takazudo/zudo-doc/html-preview-wrapper";
import { Tabs } from "@takazudo/zudo-doc/code-syntax";
import { TabItem } from "@takazudo/zudo-doc/tab-item";
import { defaultLocale, type Locale } from "@/config/i18n";
import { withBase } from "@/utils/base";
import { settings } from "@/config/settings";
import { CategoryNavWrapper } from "./lib/_category-nav";
import { CategoryTreeNavWrapper } from "./lib/_category-tree-nav";
import { SiteTreeNavWrapper } from "./lib/_site-tree-nav";
import { DetailsWrapper } from "./lib/_details";
import { PresetGeneratorFallback } from "./lib/_preset-generator";
import { MathBlock } from "./lib/_math-block";
import { CodeGroup } from "@/components/content/code-group";

/**
 * MDX `<img>` override — rewrites root-relative src attributes to include the
 * configured site base path (settings.base). Without this, an MDX image like
 * `![alt](/img/foo.webp)` emits `src="/img/foo.webp"` which 404s when the
 * site is deployed under a sub-path prefix (e.g. /my-docs/).
 *
 * Only root-relative paths (starting with "/") are rewritten; external URLs,
 * protocol-relative URLs ("//…"), and data URIs pass through unchanged. The
 * withBase() call is generic — it reads settings.base at build time and applies
 * whatever prefix is configured.
 *
 * Note: `srcset` attributes are NOT rewritten here because the current MDX
 * corpus does not use srcset (standard markdown `![alt](src)` syntax produces
 * only `src`). If srcset with root-relative URLs is ever introduced, extend
 * this override to rewrite each srcset candidate URL as well.
 */
function ContentImg(props: Record<string, unknown>) {
  const src = props.src;
  const rewrittenSrc =
    typeof src === "string" && src.startsWith("/") && !src.startsWith("//")
      ? withBase(src)
      : src;
  // Strip the "no-enlarge" sentinel from the rendered DOM — it is read by the
  // p-override before ContentImg is called (the VNode is still unlaunched at
  // that point), so we must delete it here to avoid leaking the sentinel into
  // the img title attribute.
  const { title, ...restProps } = props;
  const finalTitle = title === "no-enlarge" ? undefined : title;
  const mergedProps: Record<string, unknown> = { ...restProps, src: rewrittenSrc };
  if (finalTitle !== undefined) {
    mergedProps.title = finalTitle;
  }
  return { type: "img", props: mergedProps, key: null, constructor: undefined };
}

/**
 * MDX-tag stub: renders nothing. Returning `null` keeps the rendered
 * tree intact (Preact's null-vnode path) without leaking placeholder
 * markup into the SSR output.
 */
const MdxStub = (_props: unknown) => null;

/**
 * SSR-pass-through wrapper for `<Island when="load|idle|visible">`.
 *
 * In the zfb build the zfb `<Island>` component is unavailable, so the
 * MDX corpus tags resolve to this binding instead. Rendering the
 * children directly ensures that any server-renderable content nested
 * inside `<Island>` (headings, paragraphs, etc.) appears in the SSR
 * HTML. Client-only inner components that are themselves wrapped in an
 * SSR-skip placeholder will emit their own placeholder markup; this
 * wrapper does not suppress them.
 *
 * The `when` prop is intentionally ignored at render time — it is only
 * meaningful to the zfb hydration runtime on the client, which reads
 * the `data-when` attribute on the inner SSR-skip placeholder div (if
 * present) rather than on this wrapper.
 */
function IslandWrapper(props: {
  when?: "load" | "idle" | "visible" | "media";
  children?: ComponentChildren;
}): ComponentChildren {
  return props.children ?? null;
}

/**
 * Build an admonition stub for the given variant — renders the
 * children inside `<div class="admonition admonition-<variant>">`
 * so the body text stays visible until the proper Preact bindings
 * land. Matches the `admonition` class hook the design system already
 * targets for the Astro-era components.
 *
 * The title row is ALWAYS rendered (defaulting to the capitalized
 * variant name when no `title` prop is given). The icon emoji is
 * supplied by `.admonition-title::before` in `global.css` keyed off
 * `data-admonition`, so the stub stays variant-agnostic. This mirrors
 * the Astro reference theme's structure (zudolab/zudo-doc#1456).
 *
 * Untyped (`unknown` props) on purpose: the stubs go away once the
 * proper bindings ship, so investing in a typed prop bag here would
 * just be deleted later.
 */
function makeAdmonitionStub(variant: string) {
  // Default title — capitalized variant name (e.g. "note" → "Note"),
  // matching the Astro reference where every admonition shows a title row
  // regardless of whether the author provided one in MDX.
  const defaultTitle = variant.charAt(0).toUpperCase() + variant.slice(1);
  // The tag name is passed through `h` indirectly by the MDX runtime
  // (Preact's `h(tag, props, ...children)`), so we build a plain
  // VNode-shaped object here. Returning a real Preact vnode via
  // `h("div", ...)` would require pulling in `preact` at the call
  // site; the literal-shape is what htmlOverrides downstream emit
  // and it round-trips through `preact-render-to-string` cleanly.
  return function AdmonitionStub(props: { title?: string; children?: unknown }): unknown {
    const title = props.title && props.title.length > 0 ? props.title : defaultTitle;
    return {
      type: "div",
      props: {
        // `data-admonition` is the structural hook the smoke spec relies on
        // (independent of styling classes); the design-system class hooks
        // are kept too so existing CSS continues to apply.
        "data-admonition": variant,
        class: `admonition admonition-${variant}`,
        children: [
          { type: "p", props: { class: "admonition-title", children: title }, key: null, constructor: undefined },
          { type: "div", props: { class: "admonition-body", children: props.children }, key: null, constructor: undefined },
        ],
      },
      key: null,
      constructor: undefined,
    };
  };
}

/**
 * SVG icon for the image-enlarge button (4-corner-arrows).
 *
 * Ported verbatim from
 * packages/create-zudo-doc/templates/base/src/plugins/rehype-image-enlarge.ts
 * makeEnlargeButton() — this is the same icon the old Rust plugin emitted.
 * Must match exactly so the existing `.zd-enlarge-btn` CSS and the
 * image-enlarge island (src/components/image-enlarge.tsx) keep working.
 *
 * Attribute spellings: HTML/Preact conventions — `focusable` stays a string
 * ("false") because Preact's preact-render-to-string drops boolean false;
 * `aria-hidden` is the HTML attribute name (not ariaHidden).
 */
const ENLARGE_SVG = {
  type: "svg",
  props: {
    viewBox: "0 0 38.99 38.99",
    fill: "currentColor",
    focusable: "false",
    "aria-hidden": "true",
    children: [
      {
        type: "polygon",
        props: {
          points:
            "16.2 13.74 5.92 3.47 11.2 3.47 11.2 0 3.47 0 0 0 0 3.47 0 11.2 3.47 11.2 3.47 5.92 13.74 16.2 16.2 13.74",
        },
        key: null,
        constructor: undefined,
      },
      {
        type: "polygon",
        props: {
          points:
            "25.24 16.2 35.52 5.92 35.52 11.2 38.99 11.2 38.99 3.47 38.99 0 35.52 0 27.79 0 27.79 3.47 33.07 3.47 22.79 13.74 25.24 16.2",
        },
        key: null,
        constructor: undefined,
      },
      {
        type: "polygon",
        props: {
          points:
            "22.79 25.24 33.07 35.52 27.79 35.52 27.79 38.99 35.52 38.99 38.99 38.99 38.99 35.52 38.99 27.79 35.52 27.79 35.52 33.07 25.24 22.79 22.79 25.24",
        },
        key: null,
        constructor: undefined,
      },
      {
        type: "polygon",
        props: {
          points:
            "13.74 22.79 3.47 33.07 3.47 27.79 0 27.79 0 35.52 0 38.99 3.47 38.99 11.2 38.99 11.2 35.52 5.92 35.52 16.2 25.24 13.74 22.79",
        },
        key: null,
        constructor: undefined,
      },
    ],
  },
  key: null,
  constructor: undefined,
};

/**
 * Enlarge-aware MDX paragraph override.
 *
 * When `settings.imageEnlarge` is enabled and a paragraph contains exactly
 * one non-whitespace child that is a block-level image VNode (type ===
 * ContentImg or "img"), this wraps the image in:
 *   <figure class="zd-enlargeable">
 *     <img ...>
 *     <button type="button" class="zd-enlarge-btn" hidden aria-label="Enlarge image">
 *       <svg ...>…</svg>
 *     </button>
 *   </figure>
 *
 * The `title="no-enlarge"` opt-out is read from the un-rendered VNode
 * (Preact's h() is lazy — child.type is still the ContentImg function, not
 * yet called). ContentImg strips the sentinel from the rendered img DOM.
 *
 * All other paragraphs delegate to htmlOverrides.p (ContentParagraph passthrough).
 */
function EnlargeableParagraph(props: {
  children?: ComponentChildren;
  [key: string]: unknown;
}): unknown {
  const { children, ...rest } = props;
  // Collect children and drop whitespace-only text nodes.
  const kids = toChildArray(children).filter((child) => {
    if (typeof child === "string" || typeof child === "number") {
      return String(child).trim() !== "";
    }
    return true;
  });

  // Check for a single-image block paragraph eligible for enlarge wrapping.
  if (settings.imageEnlarge && kids.length === 1) {
    const kid = kids[0];
    // VNode type guard: must be an object with a `type` property.
    if (
      kid !== null &&
      typeof kid === "object" &&
      "type" in kid &&
      "props" in kid
    ) {
      const vnode = kid as VNode<Record<string, unknown>>;
      if (vnode.type === ContentImg || vnode.type === "img") {
        const imgProps = (vnode.props ?? {}) as Record<string, unknown>;
        // Opt-out: title="no-enlarge" — render plain paragraph (ContentImg
        // will strip the sentinel title from the actual img DOM).
        if (imgProps.title !== "no-enlarge") {
          // Wrap in figure.zd-enlargeable with the enlarge button.
          const enlargeBtn = {
            type: "button",
            props: {
              type: "button",
              class: "zd-enlarge-btn",
              hidden: true,
              "aria-label": "Enlarge image",
              children: ENLARGE_SVG,
            },
            key: null,
            constructor: undefined,
          };
          return {
            type: "figure",
            props: {
              class: "zd-enlargeable",
              children: [vnode, enlargeBtn],
            },
            key: null,
            constructor: undefined,
          };
        }
      }
    }
  }

  // Fallback: delegate to the standard ContentParagraph passthrough.
  return (htmlOverrides.p as (props: unknown) => unknown)(props);
}

/**
 * Build a locale-aware MDX components map for the given locale.
 *
 * Nav components (CategoryNav, CategoryTreeNav, SiteTreeNav, SiteTreeNavDemo)
 * resolve nav tree data at render time and need the active locale so they
 * query the right collection. The factory closes over `lang` and returns
 * locale-bound wrapper functions.
 *
 * Page modules should call createMdxComponents(locale) instead of importing
 * the static mdxComponents export.
 *
 * Components map includes:
 * - `htmlOverrides` — element-level overrides for native tags (h2..h4,
 *   p, a, ul/ol, blockquote, strong, table). Defined in
 *   `@takazudo/zudo-doc/content`.
 * - `HtmlPreview` — Island-wrapped preview component.
 * - Real Preact wrappers for CategoryNav, CategoryTreeNav, SiteTreeNav,
 *   SiteTreeNavDemo, and Details.
 * - `Island` — SSR pass-through wrapper so children render server-side.
 * - `PresetGenerator` — SSR fallback shell that renders the 8 h3 sections;
 *   interactive form hydrates client-side via SSR-skip placeholder.
 * - Stub bindings for every other custom tag the MDX corpus references.
 *
 * Keep this list in sync with the corpus when new MDX tags appear.
 * `pnpm exec grep -rohE '<[A-Z][a-zA-Z]+' src/content/` enumerates them.
 */
export function createMdxComponents(lang: Locale | string = defaultLocale) {
  // Locale-bound wrappers — close over `lang` so each wrapper queries
  // the correct collection without needing a prop.
  const CategoryNavBound = (props: Record<string, unknown>) =>
    CategoryNavWrapper({ ...(props as Parameters<typeof CategoryNavWrapper>[0]), lang });
  const CategoryTreeNavBound = (props: Record<string, unknown>) =>
    CategoryTreeNavWrapper({ ...(props as Parameters<typeof CategoryTreeNavWrapper>[0]), lang });
  const SiteTreeNavBound = (props: Record<string, unknown>) =>
    SiteTreeNavWrapper({ ...(props as Parameters<typeof SiteTreeNavWrapper>[0]), lang });

  return {
    ...htmlOverrides,
    // img override: rewrites root-relative src to include the site base path.
    // Required when settings.base is a sub-path (e.g. /my-docs/) so that
    // MDX images like ![alt](/img/foo.webp) resolve correctly on the deployed
    // site. withBase() is generic — any configured base value works.
    img: ContentImg,
    // p override: wraps block-level images in <figure class="zd-enlargeable">
    // with an enlarge button when settings.imageEnlarge is enabled.
    // Must come AFTER the ...htmlOverrides spread to override ContentParagraph.
    p: EnlargeableParagraph,
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
    // github-alerts [!IMPORTANT] and [!CAUTION] map to these variants.
    // Without these bindings, those two alert variants 500 the SSR render.
    Important: makeAdmonitionStub("important"),
    Caution: makeAdmonitionStub("caution"),
    // codeTabs Option A: zfb emits <CodeGroup tabs={[...]}> for :::code-group.
    // The framework does not ship this component; we implement it here and map
    // the tabs[] + <pre data-lang> children to the existing Tabs/TabItem UI.
    CodeGroup: CodeGroup as unknown as (props: Record<string, unknown>) => unknown,
    // Showcase / nav helpers — real Preact wrappers replacing MdxStub.
    CategoryNav: CategoryNavBound,
    CategoryTreeNav: CategoryTreeNavBound,
    SiteTreeNav: SiteTreeNavBound,
    SiteTreeNavDemo: SiteTreeNavBound,
    Details: DetailsWrapper,
    Tabs,
    TabItem,
    // Math rendering — KaTeX via server-side katex.renderToString().
    // The math-equations.mdx content files write <MathBlock> JSX directly
    // (instead of $$…$$) because the zfb Rust emitter does not yet support
    // remark-math math nodes (zudo-front-builder #93).
    MathBlock,
    SmartBreak: MdxStub,
    // Island: pass children through so server-renderable content nested
    // inside <Island> appears in SSR HTML. See IslandWrapper comment above.
    Island: IslandWrapper,
    // PresetGenerator: render the 8 section headings as static SSR HTML for
    // a11y/SEO section structure and no-JS layout stability. The interactive
    // form loads client-side via the SSR-skip placeholder inside
    // PresetGeneratorFallback (see pages/lib/_preset-generator.tsx).
    PresetGenerator: PresetGeneratorFallback,
    // Pure showcase placeholders (Avatar/Button/Card/MyComponent/PageLayout
    // appear only inside MDX prose as illustrative examples — never
    // implemented as real components).
    Avatar: MdxStub,
    Button: MdxStub,
    Card: MdxStub,
    MyComponent: MdxStub,
    PageLayout: MdxStub,
  };
}

/**
 * Static default-locale components map for backward compatibility.
 * New page modules should call createMdxComponents(locale) instead.
 */
export const mdxComponents = createMdxComponents(defaultLocale);
