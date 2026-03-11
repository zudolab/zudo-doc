import type { Root, Element, Text } from "hast";
import { visit } from "unist-util-visit";

/**
 * Rehype plugin that transforms mermaid code blocks into renderable containers.
 *
 * After Shiki processes code blocks, mermaid blocks become:
 *   <pre data-language="mermaid"><code><span>...</span></code></pre>
 *
 * This plugin converts them to:
 *   <div class="mermaid" data-mermaid>graph LR; A-->B</div>
 */

function extractText(node: Element | Text): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") {
    return node.children.map((c) => extractText(c as Element | Text)).join("");
  }
  return "";
}

export function rehypeMermaid() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (
        node.tagName !== "pre" ||
        !parent ||
        index === undefined
      ) return;

      // Match Shiki-processed mermaid blocks (data-language="mermaid")
      if (node.properties?.dataLanguage !== "mermaid") return;

      // Extract all text content recursively from the code/span tree
      const text = node.children
        .map((c) => extractText(c as Element | Text))
        .join("");

      // Replace the <pre> with a <div class="mermaid">
      (parent as Element).children[index] = {
        type: "element",
        tagName: "div",
        properties: { className: ["mermaid"], "data-mermaid": true },
        children: [{ type: "text", value: text }],
      };
    });
  };
}
