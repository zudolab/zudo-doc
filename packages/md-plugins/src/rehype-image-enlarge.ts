import type { Root, Element, ElementContent } from "hast";
import { visit, SKIP } from "unist-util-visit";

function isWhitespaceText(node: ElementContent): boolean {
  return node.type === "text" && node.value.trim() === "";
}

function isEnlargeableFigure(node: ElementContent): boolean {
  if (node.type !== "element" || node.tagName !== "figure") return false;
  const cls = node.properties?.className;
  return Array.isArray(cls) && cls.includes("zd-enlargeable");
}

function makeEnlargeButton(): Element {
  return {
    type: "element",
    tagName: "button",
    properties: {
      type: "button",
      className: ["zd-enlarge-btn"],
      ariaLabel: "Enlarge image",
      hidden: true,
    },
    children: [
      {
        type: "element",
        tagName: "svg",
        properties: {
          width: "16",
          height: "16",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          ariaHidden: "true",
        },
        children: [
          {
            type: "element",
            tagName: "polyline",
            properties: { points: "15 3 21 3 21 9" },
            children: [],
          },
          {
            type: "element",
            tagName: "polyline",
            properties: { points: "9 21 3 21 3 15" },
            children: [],
          },
          {
            type: "element",
            tagName: "line",
            properties: { x1: "21", y1: "3", x2: "14", y2: "10" },
            children: [],
          },
          {
            type: "element",
            tagName: "line",
            properties: { x1: "3", y1: "21", x2: "10", y2: "14" },
            children: [],
          },
        ],
      },
    ],
  };
}

export function rehypeImageEnlarge() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "p" || !parent || index === undefined) return;

      const nonWs = node.children.filter((c) => !isWhitespaceText(c));

      // Idempotency: <p> already contains a wrapped figure
      if (nonWs.length === 1 && isEnlargeableFigure(nonWs[0])) return SKIP;

      // Case A requires exactly one non-whitespace child that is <img>
      if (nonWs.length !== 1) return;
      const child = nonWs[0];
      if (child.type !== "element" || child.tagName !== "img") return;

      const imgEl = child;

      // Opt-out: exact title="no-enlarge" — skip wrap but remove title attr
      if (imgEl.properties?.title === "no-enlarge") {
        const newProps = { ...imgEl.properties };
        delete newProps.title;
        imgEl.properties = newProps;
        return SKIP;
      }

      const figureEl: Element = {
        type: "element",
        tagName: "figure",
        properties: { className: ["zd-enlargeable"] },
        children: [imgEl, makeEnlargeButton()],
      };

      (parent as Element).children[index] = figureEl;
      return SKIP;
    });
  };
}
