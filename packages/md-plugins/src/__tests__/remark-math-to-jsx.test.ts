import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import type { Root, Node as MdastNode } from "mdast";
import { remarkMathToJsx } from "../remark-math-to-jsx";

/** Collect all nodes of a given type from the tree (shallow walk). */
function collectNodes(tree: Root, type: string): MdastNode[] {
  const out: MdastNode[] = [];
  function walk(node: MdastNode) {
    if (node.type === type) out.push(node);
    const children = (node as { children?: MdastNode[] }).children;
    if (Array.isArray(children)) children.forEach(walk);
  }
  walk(tree as unknown as MdastNode);
  return out;
}

function parse(src: string): Root {
  // Use runSync (synchronous tree transform) rather than `.parse()` alone.
  // `.parse()` only parses to AST without running attached plugins; we need
  // `.run()` / `.runSync()` to apply the remark-math and remarkMathToJsx
  // transform plugins before inspecting the tree.
  const processor = unified().use(remarkParse).use(remarkMath).use(remarkMathToJsx);
  const tree = processor.parse(src);
  return processor.runSync(tree) as unknown as Root;
}

describe("remarkMathToJsx", () => {
  it("converts a block math node to mdxJsxFlowElement named MathBlock", () => {
    const tree = parse("$$\n\\pi\n$$\n");
    const nodes = collectNodes(tree, "mdxJsxFlowElement");
    expect(nodes).toHaveLength(1);
    const node = nodes[0] as unknown as {
      name: string;
      attributes: { type: string; name: string; value: unknown }[];
    };
    expect(node.name).toBe("MathBlock");

    const latexAttr = node.attributes.find((a) => a.name === "latex");
    expect(latexAttr).toBeDefined();
    expect(latexAttr?.value).toBe("\\pi");

    const blockAttr = node.attributes.find((a) => a.name === "block");
    expect(blockAttr).toBeDefined();
    // block={true} is an expression attribute
    expect((blockAttr?.value as { value: string })?.value).toBe("true");
  });

  it("converts an inline math node to mdxJsxTextElement named MathBlock", () => {
    const tree = parse("The formula $E = mc^2$ is inline.\n");
    const nodes = collectNodes(tree, "mdxJsxTextElement");
    expect(nodes).toHaveLength(1);
    const node = nodes[0] as unknown as {
      name: string;
      attributes: { type: string; name: string; value: unknown }[];
    };
    expect(node.name).toBe("MathBlock");

    const latexAttr = node.attributes.find((a) => a.name === "latex");
    expect(latexAttr).toBeDefined();
    expect(latexAttr?.value).toBe("E = mc^2");

    const blockAttr = node.attributes.find((a) => a.name === "block");
    expect(blockAttr).toBeDefined();
    expect((blockAttr?.value as { value: string })?.value).toBe("false");
  });

  it("removes the original math / inlineMath nodes from the tree", () => {
    const tree = parse("$$\n\\alpha\n$$\n\nAnd $\\beta$ inline.\n");
    expect(collectNodes(tree, "math")).toHaveLength(0);
    expect(collectNodes(tree, "inlineMath")).toHaveLength(0);
  });

  it("preserves LaTeX that contains backslash identifiers (the zfb bridge trigger)", () => {
    // LaTeX like \infty would produce invalid JSX `{\infty}` in the raw emitter.
    // After this plugin runs, the value is safely stored as a string attribute.
    const tree = parse("$$\n\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}\n$$\n");
    const nodes = collectNodes(tree, "mdxJsxFlowElement");
    expect(nodes).toHaveLength(1);
    const node = nodes[0] as unknown as {
      attributes: { name: string; value: string }[];
    };
    const latex = node.attributes.find((a) => a.name === "latex")?.value ?? "";
    expect(typeof latex).toBe("string");
    expect(latex).toContain("\\infty");
    expect(latex).toContain("\\sqrt");
  });

  it("is a no-op when there are no math nodes", () => {
    const tree = parse("Hello **world**.\n");
    expect(collectNodes(tree, "mdxJsxFlowElement")).toHaveLength(0);
    expect(collectNodes(tree, "mdxJsxTextElement")).toHaveLength(0);
  });
});
