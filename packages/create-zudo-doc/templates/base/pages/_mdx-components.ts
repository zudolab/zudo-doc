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

import type { ComponentChildren } from "preact";
// @slot:mdx-components:enlarge-imports
import { htmlOverrides } from "@takazudo/zudo-doc/content";
import { HtmlPreviewWrapper } from "@takazudo/zudo-doc/html-preview-wrapper";
import { Tabs } from "@takazudo/zudo-doc/code-syntax";
import { TabItem } from "@takazudo/zudo-doc/tab-item";
import { defaultLocale, type Locale } from "@/config/i18n";
import { withBase } from "@/utils/base";
import { CategoryNavWrapper } from "./lib/_category-nav";
import { CategoryTreeNavWrapper } from "./lib/_category-tree-nav";
import { SiteTreeNavWrapper } from "./lib/_site-tree-nav";
import { DetailsWrapper } from "./lib/_details";
import { PresetGeneratorFallback } from "./lib/_preset-generator";
import { MathBlock } from "./lib/_math-block";
import { CodeGroup } from "@/components/content/code-group";
import { makeAdmonition } from "@/components/content/content-admonition";

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

// @slot:mdx-components:enlarge-defs
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
    // @slot:mdx-components:enlarge-p-entry
    HtmlPreview: HtmlPreviewWrapper,
    // Admonitions — real typed Preact components (src/components/content/
    // content-admonition.tsx) emitting the `.admonition` / `data-admonition`
    // structure the design-system CSS targets. `admonitionsPreset` emits these
    // tags from `:::note` directives; `<Note title="…">` JSX form is also
    // authored directly.
    Note: makeAdmonition("note"),
    Tip: makeAdmonition("tip"),
    Info: makeAdmonition("info"),
    Warning: makeAdmonition("warning"),
    Danger: makeAdmonition("danger"),
    // github-alerts [!IMPORTANT] and [!CAUTION] map to these variants.
    // Without these bindings, those two alert variants 500 the SSR render.
    Important: makeAdmonition("important"),
    Caution: makeAdmonition("caution"),
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
