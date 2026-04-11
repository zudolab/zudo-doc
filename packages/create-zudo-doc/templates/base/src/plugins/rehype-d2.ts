import type { Root, Element } from "hast";
import { visit } from "unist-util-visit";
import { extractText } from "./hast-utils";

/**
 * Rehype plugin that transforms D2 code blocks into renderable containers.
 *
 * After Shiki processes code blocks, D2 blocks become:
 *   <pre data-language="d2"><code><span>...</span></code></pre>
 *
 * This plugin converts them to:
 *   <div class="d2-diagram" data-d2>x -> y</div>
 */

export function rehypeD2() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (
        node.tagName !== "pre" ||
        !parent ||
        index === undefined
      ) return;

      // Match Shiki-processed D2 blocks (data-language="d2")
      if (node.properties?.dataLanguage !== "d2") return;

      // Extract all text content recursively from the code/span tree
      const text = node.children
        .map((c) => extractText(c))
        .join("");

      // Replace the <pre> with a <div class="d2-diagram">
      (parent as Element).children[index] = {
        type: "element",
        tagName: "div",
        properties: {
          className: ["d2-diagram"],
          "data-d2": true,
          role: "img",
          "aria-label": "D2 diagram",
        },
        children: [{ type: "text", value: text }],
      };
    });
  };
}
