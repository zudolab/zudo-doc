// createMdxComponents — locale-bound MDX components factory.
//
// Moved from the showcase's `pages/_mdx-components.ts` into the shared package
// as part of the package-first migration (epic #2321, S8 #2332).
//
// ## Why a factory at the call site (NOT a static global slot)
//
// zfb's idiomatic `mdx-components.tsx` convention is a single static
// default-export map. zudo-doc deliberately does NOT adopt it: the nav
// components (CategoryNav / CategoryTreeNav / SiteTreeNav / SiteTreeNavDemo)
// resolve their tree data per-locale, and the `img` base-rewrite reads the
// host's configured base path. A single static map cannot be parameterized by
// locale, so it would render the EN nav tree on every `/ja` page. The factory
// is therefore called once per page render with the active `locale`, and it
// threads that locale into the host-supplied nav wrappers so `/ja` gets the JA
// collection. Keep this shape — a static global slot would break `/ja`.
//
// ## What the package bakes vs what the host supplies
//
// The factory bakes every component that lives entirely inside the package:
//   - defaultComponents (h2..h4, p, a, ul, ol, blockquote, strong, table, code)
//   - admonitions (Note/Tip/Info/Warning/Danger/Important/Caution)
//   - CodeGroup, Tabs, TabItem
//   - MathBlock
//   - the `img` base-rewrite override
//   - the enlargeable-`p` override
//
// The host supplies, per call:
//   - `navData` — the 4 nav wrappers, which depend on the project's content
//     collections / nav-tree utilities and CANNOT live in the package. The
//     factory injects `locale` into each (the /ja-correctness mechanism).
//   - `extras` — any further project-bound bindings (HtmlPreview-with-config,
//     Details, Island pass-through, PresetGenerator SSR shell, showcase stubs
//     like Avatar/Button/Card). Spread LAST so the host always wins.

/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { toChildArray } from "preact";
import type { ComponentChildren, VNode } from "preact";
import type { Settings } from "../settings.js";
import type { AssetManifest } from "../route-context-payload/types.js";
import { defaultComponents } from "../content/index.js";
import { createContentLink } from "../content/content-link.js";
import { decodeAuthoredHref, assetViewerHref } from "../asset-path/index.js";
import { makeAdmonition } from "../content-admonition/index.js";
import { CodeGroup } from "../code-group/index.js";
import { Tabs } from "../code-syntax/index.js";
import { TabItem } from "../tab-item/index.js";
import { MathBlock } from "../math-block/index.js";

/** Any Preact-renderable component (function returning a VNode/children). */
type AnyComponent = (props: Record<string, unknown>) => unknown;

/**
 * The host-supplied, locale-aware nav wrappers. Each accepts a `lang` prop;
 * the factory injects the active `locale` so the wrapper queries the correct
 * collection. `SiteTreeNav` is reused for both the `SiteTreeNav` and
 * `SiteTreeNavDemo` MDX tags (matching the showcase mapping).
 */
export interface MdxNavData {
  CategoryNav: AnyComponent;
  CategoryTreeNav: AnyComponent;
  SiteTreeNav: AnyComponent;
  NoteTrayIndex: AnyComponent;
}

export interface CreateMdxComponentsOptions {
  /**
   * The host's resolved settings object. Read for `base` (img rewrite),
   * `imageEnlarge` (enlargeable-`p`). Only these fields are consumed here.
   */
  settings: Pick<
    Settings,
    "base" | "imageEnlarge" | "assetViewerDir" | "assetViewerRoutePrefix"
  >;
  /** Author-facing asset index. Null/omitted keeps all MDX overrides inert. */
  assetManifest?: AssetManifest | null;
  /**
   * Active locale for this render. Injected into each `navData` wrapper as the
   * `lang` prop so `/ja` pages resolve the JA collection. Load-bearing — do not
   * drop it.
   */
  locale: string;
  /**
   * Active version slug for a `/v/{version}` route render, or `undefined` for
   * latest/unversioned pages. Injected into each `navData` wrapper as the
   * `currentVersion` prop alongside `lang` (#3218) so CategoryNav /
   * CategoryTreeNav / SiteTreeNav resolve the version's doc collection and
   * remap emitted hrefs into their versioned form — mirroring the sidebar's
   * `buildSidebarNodes` two-step. Applies equally to a host-supplied
   * `ctx.components` override, since the prop is injected here regardless of
   * which wrapper `navData` holds.
   */
  currentVersion?: string;
  /** Canonical slug of the page being rendered, used to infer its containing note tray. */
  currentSlug: string;
  /** Host-supplied locale-aware nav wrappers. */
  navData: MdxNavData;
  /**
   * Further host-bound bindings, spread LAST so the host always wins. Typical
   * contents: `HtmlPreview`, `Details`, `Island`, `PresetGenerator`, and the
   * showcase stubs (`Avatar`/`Button`/`Card`/…).
   */
  extras?: Record<string, unknown>;
}

/**
 * Build the `img` base-rewrite override for the configured base path.
 *
 * Rewrites root-relative `src` attributes (`/img/foo.webp`) to include
 * `settings.base` so images resolve when the site is deployed under a sub-path
 * prefix (e.g. `/my-docs/`). External, protocol-relative (`//…`), and data
 * URIs pass through unchanged.
 *
 * The base prefix is applied verbatim (no trailing-slash handling): image URLs
 * always carry a file extension, so the host's `withBase` trailing-slash branch
 * is a no-op for them — prefix-only is behaviourally identical here while
 * keeping this module free of the host's URL utilities (and node builtins).
 *
 * `srcset` is NOT rewritten — standard markdown `![alt](src)` emits only `src`.
 * Extend this if root-relative `srcset` is ever introduced.
 *
 * The `title="no-enlarge"` sentinel is read by the enlargeable-`p` override
 * before this component runs (the child VNode is still unrendered there), so
 * it is stripped here to avoid leaking the sentinel into the rendered `title`.
 */
function makeContentImg(base: string) {
  const normalizedBase = base.replace(/\/+$/, "");
  return function ContentImg(props: Record<string, unknown>) {
    const src = props.src;
    const rewrittenSrc =
      typeof src === "string" &&
      src.startsWith("/") &&
      !src.startsWith("//") &&
      normalizedBase !== ""
        ? `${normalizedBase}${src}`
        : src;
    const { title, ...restProps } = props;
    const finalTitle = title === "no-enlarge" ? undefined : title;
    const mergedProps: Record<string, unknown> = { ...restProps, src: rewrittenSrc };
    if (finalTitle !== undefined) {
      mergedProps.title = finalTitle;
    }
    return { type: "img", props: mergedProps, key: null, constructor: undefined };
  };
}

/**
 * SVG icon for the image-enlarge button (4-corner-arrows).
 *
 * Ported verbatim from the showcase `pages/_mdx-components.ts` (originally from
 * `rehype-image-enlarge.ts` makeEnlargeButton()). Must match exactly so the
 * existing `.zd-enlarge-btn` CSS and the image-enlarge island keep working.
 *
 * Attribute spellings follow HTML/Preact conventions: `focusable` stays the
 * string "false" (preact-render-to-string drops boolean false); `aria-hidden`
 * is the HTML attribute name.
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
 * Build the enlarge-aware MDX paragraph override.
 *
 * When a paragraph contains exactly one non-whitespace child that is a
 * block-level image VNode (type === the ContentImg override or "img"), this
 * wraps enlargeable images in:
 *   <figure class="zd-enlargeable">
 *     <img ...>
 *     <button type="button" class="zd-enlarge-btn" hidden aria-label="Enlarge image">
 *       <svg ...>…</svg>
 *     </button>
 *   </figure>
 *
 * A matching manifest image also receives a figcaption with its authored alt
 * text, dimensions, and viewer link, whether or not enlargement is enabled.
 *
 * The `title="no-enlarge"` opt-out is read from the un-rendered VNode (Preact's
 * h() is lazy — child.type is still the ContentImg function, not yet called).
 * ContentImg strips the sentinel from the rendered img DOM.
 *
 * Non-image and non-manifest/non-enlargeable paragraphs delegate to
 * defaultComponents.p (ContentParagraph).
 */
function makeEnlargeableParagraph(
  imageEnlarge: boolean,
  ContentImg: AnyComponent,
  assetOptions: {
    base: string;
    dir: string;
    routePrefix: string;
    manifest: AssetManifest | null;
  },
) {
  return function EnlargeableParagraph(props: {
    children?: ComponentChildren;
    [key: string]: unknown;
  }): unknown {
    const { children } = props;
    // Collect children and drop whitespace-only text nodes.
    const kids = toChildArray(children).filter((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child).trim() !== "";
      }
      return true;
    });

    if (kids.length === 1) {
      const kid = kids[0];
      if (
        kid !== null &&
        typeof kid === "object" &&
        "type" in kid &&
        "props" in kid
      ) {
        const vnode = kid as VNode<Record<string, unknown>>;
        if (vnode.type === ContentImg || vnode.type === "img") {
          const imgProps = (vnode.props ?? {}) as Record<string, unknown>;
          const decoded =
            typeof imgProps.src === "string"
              ? decodeAuthoredHref(imgProps.src, {
                  base: assetOptions.base,
                  dir: assetOptions.dir,
                })
              : null;
          const imageEntry = decoded
            ? assetOptions.manifest?.entries.find(
                (entry) => entry.path === decoded.path && entry.kind === "image",
              )
            : undefined;
          const canEnlarge = imageEnlarge && imgProps.title !== "no-enlarge";
          if (canEnlarge || imageEntry) {
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
            const captionText =
              typeof imgProps.alt === "string" ? imgProps.alt.trim() : "";
            const dimensions =
              imageEntry?.width !== undefined && imageEntry.height !== undefined
                ? ` · ${imageEntry.width} × ${imageEntry.height}`
                : "";
            const figcaption = imageEntry
              ? {
                  type: "figcaption",
                  props: {
                    class:
                      "mt-vsp-2xs flex flex-wrap items-baseline justify-center gap-x-hsp-xs text-caption text-muted",
                    children: [
                      captionText
                        ? {
                            type: "span",
                            props: { children: captionText },
                            key: null,
                            constructor: undefined,
                          }
                        : null,
                      captionText
                        ? {
                            type: "span",
                            props: { "aria-hidden": "true", children: "|" },
                            key: null,
                            constructor: undefined,
                          }
                        : null,
                      {
                        type: "a",
                        props: {
                          class:
                            "text-accent hover:underline focus-visible:underline",
                          href: assetViewerHref({
                            base: assetOptions.base,
                            routePrefix: assetOptions.routePrefix,
                            path: imageEntry.path,
                          }),
                          children: `⤢ Open asset page${dimensions}`,
                        },
                        key: null,
                        constructor: undefined,
                      },
                    ],
                  },
                  key: null,
                  constructor: undefined,
                }
              : null;
            return {
              type: "figure",
              props: {
                ...(canEnlarge ? { class: "zd-enlargeable" } : {}),
                children: [vnode, canEnlarge ? enlargeBtn : null, figcaption],
              },
              key: null,
              constructor: undefined,
            };
          }
        }
      }
    }

    return (defaultComponents.p as (props: unknown) => unknown)(props);
  };
}

/**
 * Build the locale-bound MDX components map.
 *
 * Called once per page render with the active `locale`. Bakes all
 * package-resident components and threads `locale` into the host-supplied
 * `navData` wrappers (the /ja-correctness mechanism), then spreads `extras`
 * last so host bindings (HtmlPreview, Details, Island, PresetGenerator,
 * showcase stubs) win over any same-named default.
 */
export function createMdxComponents(
  options: CreateMdxComponentsOptions,
): Record<string, unknown> {
  const {
    settings,
    assetManifest = null,
    locale,
    currentVersion,
    currentSlug,
    navData,
    extras,
  } = options;

  const ContentImg = makeContentImg(settings.base);
  const EnlargeableParagraph = makeEnlargeableParagraph(
    settings.imageEnlarge,
    ContentImg,
    {
      base: settings.base,
      dir: settings.assetViewerDir,
      routePrefix: settings.assetViewerRoutePrefix,
      manifest: assetManifest,
    },
  );
  const ManifestAwareContentLink = assetManifest
    ? createContentLink({
        base: settings.base,
        assetManifest,
        routePrefix: settings.assetViewerRoutePrefix,
        dir: settings.assetViewerDir,
      })
    : defaultComponents.a;

  // Locale-bound nav wrappers — inject `lang: locale` so `/ja` resolves the JA
  // collection, and `currentVersion` (#3218) so `/v/{version}` pages resolve
  // the version's collection and remap hrefs. Both are load-bearing.
  const CategoryNavBound = (props: Record<string, unknown>) =>
    navData.CategoryNav({ ...props, lang: locale, currentVersion });
  const CategoryTreeNavBound = (props: Record<string, unknown>) =>
    navData.CategoryTreeNav({ ...props, lang: locale, currentVersion });
  const SiteTreeNavBound = (props: Record<string, unknown>) =>
    navData.SiteTreeNav({ ...props, lang: locale, currentVersion });
  const NoteTrayIndexBound = (props: Record<string, unknown>) =>
    navData.NoteTrayIndex({ ...props, lang: locale, currentVersion, currentSlug });

  return {
    ...defaultComponents,
    // Exact manifest matches become decorated viewer links. With no manifest,
    // retain the public ContentLink component by identity and behavior.
    a: ManifestAwareContentLink,
    // img override: rewrites root-relative src to include settings.base.
    img: ContentImg,
    // p override: wraps block-level images in <figure class="zd-enlargeable">.
    // Must come AFTER ...defaultComponents to override ContentParagraph.
    p: EnlargeableParagraph,
    // Admonitions — real typed Preact components emitting the
    // `.admonition` / `data-admonition` structure the design-system CSS
    // targets. `:::note` directives emit <Note>; `<Note title="…">` JSX is
    // also authored directly. github-alerts [!IMPORTANT]/[!CAUTION] map to
    // Important/Caution — omitting those two 500s their SSR render.
    Note: makeAdmonition("note"),
    Tip: makeAdmonition("tip"),
    Info: makeAdmonition("info"),
    Warning: makeAdmonition("warning"),
    Danger: makeAdmonition("danger"),
    Important: makeAdmonition("important"),
    Caution: makeAdmonition("caution"),
    // codeTabs Option A: zfb emits <CodeGroup tabs={[...]}> for :::code-group.
    CodeGroup: CodeGroup as unknown as AnyComponent,
    Tabs,
    TabItem,
    // Math — KaTeX via server-side katex.renderToString(). math-equations.mdx
    // writes <MathBlock latex="…" block /> directly (zfb's Rust emitter does
    // not yet support $$…$$ — zudo-front-builder #93).
    MathBlock,
    // Locale-bound nav wrappers (host-supplied; locale injected above).
    // SiteTreeNav is reused for the SiteTreeNavDemo tag.
    CategoryNav: CategoryNavBound,
    CategoryTreeNav: CategoryTreeNavBound,
    SiteTreeNav: SiteTreeNavBound,
    SiteTreeNavDemo: SiteTreeNavBound,
    NoteTrayIndex: NoteTrayIndexBound,
    // Host extras win over any same-named default above (Details, HtmlPreview,
    // Island, PresetGenerator, showcase stubs, etc.).
    ...(extras ?? {}),
  };
}
