import type { Root, Node as MdastNode } from "mdast";
import { visit, SKIP } from "unist-util-visit";

/**
 * Remark plugin that converts `remark-math`-produced `math` and `inlineMath`
 * MDAST nodes into MDX JSX element nodes (`<MathBlock>`).
 *
 * ## Why this exists
 *
 * The zfb MDX→JSX emitter (zudo-front-builder issue #93) does not handle
 * `math` / `inlineMath` nodes from `remark-math`. LaTeX content such as
 * `\infty` inside `$$…$$` fences is emitted verbatim as a JSX expression
 * container `{\infty}` — invalid JS that esbuild rejects, causing the zfb
 * bundler to skip the MDX bridge entirely and fall back to the
 * `<pre data-zfb-content-fallback>` shape.
 *
 * This plugin must run AFTER `remark-math` has parsed the source into
 * `math` / `inlineMath` nodes and BEFORE the MDX→JSX emit step. It
 * replaces each node with an `mdxJsxFlowElement` / `mdxJsxTextElement`
 * named `MathBlock`, carrying a `latex` attribute with the raw LaTeX source
 * and a boolean `block` attribute. The consumer registers `MathBlock` in
 * the MDX components map and renders via KaTeX at build time.
 *
 * ## Usage in the JS pipeline (unified / remark)
 *
 *   unified()
 *     .use(remarkParse)
 *     .use(remarkMath)
 *     .use(remarkMathToJsx)     // ← after remarkMath, before hast/JSX emit
 *     …
 *
 * ## Usage in zfb consumer MDX files
 *
 * For the zfb bridge workaround, the source .mdx files must use the
 * `<MathBlock>` JSX syntax directly (rather than `$$…$$`), because the
 * zfb Rust pipeline does not run Node.js remark plugins. This plugin is
 * provided for the JS-side fixture pipeline parity; in zfb-hosted builds
 * the MDX files already contain `<MathBlock>` tags and this plugin is a
 * no-op (no `math` / `inlineMath` nodes to transform).
 */

/** A `math` node produced by `remark-math` (block math, `$$…$$`). */
interface MathNode extends MdastNode {
  type: "math";
  value: string;
}

/** An `inlineMath` node produced by `remark-math` (inline math, `$…$`). */
interface InlineMathNode extends MdastNode {
  type: "inlineMath";
  value: string;
}

/** Minimal MDX JSX attribute shape. */
interface MdxJsxAttribute {
  type: "mdxJsxAttribute";
  name: string;
  value:
    | string
    | {
        type: "mdxJsxAttributeValueExpression";
        value: string;
      }
    | null;
}

/** Minimal MDX JSX boolean expression attribute shape. */
interface MdxJsxAttributeValueExpression {
  type: "mdxJsxAttributeValueExpression";
  value: string;
}

function makeBoolAttr(name: string, val: boolean): MdxJsxAttribute {
  const expr: MdxJsxAttributeValueExpression = {
    type: "mdxJsxAttributeValueExpression",
    value: String(val),
  };
  return {
    type: "mdxJsxAttribute",
    name,
    value: expr,
  };
}

function makeStringAttr(name: string, val: string): MdxJsxAttribute {
  return {
    type: "mdxJsxAttribute",
    name,
    value: val,
  };
}

export function remarkMathToJsx() {
  return (tree: Root) => {
    // Block math (`$$…$$`) → <MathBlock latex="…" block={true} />
    visit(tree, (node: MdastNode) => {
      if (node.type === "math") {
        const math = node as MathNode;
        (math as unknown as Record<string, unknown>).type = "mdxJsxFlowElement";
        (math as unknown as Record<string, unknown>).name = "MathBlock";
        (math as unknown as Record<string, unknown>).attributes = [
          makeStringAttr("latex", math.value),
          makeBoolAttr("block", true),
        ];
        (math as unknown as Record<string, unknown>).children = [];
        delete (math as unknown as Record<string, unknown>).value;
        return SKIP;
      }
    });

    // Inline math (`$…$`) → <MathBlock latex="…" block={false} />
    visit(tree, (node: MdastNode) => {
      if (node.type === "inlineMath") {
        const math = node as InlineMathNode;
        (math as unknown as Record<string, unknown>).type = "mdxJsxTextElement";
        (math as unknown as Record<string, unknown>).name = "MathBlock";
        (math as unknown as Record<string, unknown>).attributes = [
          makeStringAttr("latex", math.value),
          makeBoolAttr("block", false),
        ];
        (math as unknown as Record<string, unknown>).children = [];
        delete (math as unknown as Record<string, unknown>).value;
        return SKIP;
      }
    });
  };
}
