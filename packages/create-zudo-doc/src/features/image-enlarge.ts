import type { FeatureModule } from "../compose.js";

/**
 * Image-enlarge feature.
 *
 * W7A (#1736): post-cutover, the image-enlarge island is mounted by the
 * pages/lib body-end wrapper (always present; runtime-gated via the
 * always-loaded stub-or-real ImageEnlarge component). Image-enlarge CSS
 * lives unconditionally in `@takazudo/zudo-doc/features.css` (moved from
 * `global.css` in S3 #2348) — the selectors only activate when the runtime
 * mounts the .zd-enlarge-btn.
 *
 * S2 (#1825): after zfb next.18 removed the built-in imageEnlarge Rust
 * feature, the server-side figure/button emission is re-implemented via an
 * MDX paragraph (p) component override in pages/_mdx-components.ts. When
 * imageEnlarge is enabled, three injections into the template file install:
 *   1. Additional imports: toChildArray + VNode from preact.
 *   2. ENLARGE_SVG const + EnlargeableParagraph function definition.
 *   3. `p: EnlargeableParagraph` entry in the createMdxComponents return map.
 * When imageEnlarge is OFF, none of these are injected, so the override is
 * absent and paragraphs render plain (the Rust built-in is gone — "off" must
 * mean no wrapping at all).
 *
 * S3 (#2348): the ImageEnlarge island and its SSR fallback moved from
 * src/components/image-enlarge.tsx into @takazudo/zudo-doc/image-enlarge.
 * The pages/lib/_body-end-islands.tsx template now imports them from the
 * package, so the local component file overlay was removed from
 * templates/features/imageEnlarge/files/. No file-copy injections remain
 * in this feature module — only _mdx-components.ts injections.
 */
export const imageEnlargeFeature: FeatureModule = () => ({
  name: "imageEnlarge",
  injections: [
    // 1. Import additions: toChildArray + VNode from preact.
    //    Inserted AFTER the `// @slot:mdx-components:enlarge-imports` anchor.
    //    NOTE: `settings` is NOT injected here — the base template already
    //    imports it (#2172); injecting it again caused a duplicate ES-module
    //    lexical binding.
    {
      file: "pages/_mdx-components.ts",
      anchor: "// @slot:mdx-components:enlarge-imports",
      position: "after",
      content: `import { toChildArray } from "preact";
import type { VNode } from "preact";`,
    },
    // 2. ENLARGE_SVG const + EnlargeableParagraph function.
    //    Inserted AFTER the `// @slot:mdx-components:enlarge-defs` anchor
    //    (which sits just before the `createMdxComponents` JSDoc comment).
    //    Markup is ported verbatim from rehype-image-enlarge.ts makeEnlargeButton()
    //    so the island's eligibility/[hidden] logic and CSS keep working identically.
    {
      file: "pages/_mdx-components.ts",
      anchor: "// @slot:mdx-components:enlarge-defs",
      position: "after",
      content: `/**
 * SVG icon for the image-enlarge button (4-corner-arrows).
 *
 * Ported verbatim from
 * packages/create-zudo-doc/templates/base/src/plugins/rehype-image-enlarge.ts
 * makeEnlargeButton() — this is the same icon the old Rust plugin emitted.
 * Must match exactly so the existing .zd-enlarge-btn CSS and the
 * image-enlarge island (src/components/image-enlarge.tsx) keep working.
 *
 * Attribute spellings: HTML/Preact conventions — \`focusable\` stays a string
 * ("false") because Preact's preact-render-to-string drops boolean false;
 * \`aria-hidden\` is the HTML attribute name (not ariaHidden).
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
 * When \`settings.imageEnlarge\` is enabled and a paragraph contains exactly
 * one non-whitespace child that is a block-level image VNode (type ===
 * ContentImg or "img"), this wraps the image in:
 *   <figure class="zd-enlargeable">
 *     <img ...>
 *     <button type="button" class="zd-enlarge-btn" hidden aria-label="Enlarge image">
 *       <svg ...>…</svg>
 *     </button>
 *   </figure>
 *
 * The \`title="no-enlarge"\` opt-out is read from the un-rendered VNode
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
    // VNode type guard: must be an object with a \`type\` property.
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
`,
    },
    // 3. p: EnlargeableParagraph entry in createMdxComponents return map.
    //    Inserted AFTER the `// @slot:mdx-components:enlarge-p-entry` anchor
    //    (which sits between `img: ContentImg,` and `HtmlPreview:`).
    //    Must come AFTER the ...htmlOverrides spread to override ContentParagraph.
    {
      file: "pages/_mdx-components.ts",
      anchor: "// @slot:mdx-components:enlarge-p-entry",
      position: "after",
      content: `    // p override: wraps block-level images in <figure class="zd-enlargeable">
    // with an enlarge button when settings.imageEnlarge is enabled.
    // Must come AFTER the ...htmlOverrides spread to override ContentParagraph.
    p: EnlargeableParagraph,`,
    },
  ],
});
