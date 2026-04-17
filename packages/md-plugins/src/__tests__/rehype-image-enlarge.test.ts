import { describe, it, expect } from "vitest";
import type { Root, Element, ElementContent, Text } from "hast";
import { rehypeImageEnlarge } from "../rehype-image-enlarge";

function makeImg(props: Record<string, unknown> = {}): Element {
  return { type: "element", tagName: "img", properties: props, children: [] };
}

function makeP(...children: ElementContent[]): Element {
  return { type: "element", tagName: "p", properties: {}, children };
}

function makeTree(...children: ElementContent[]): Root {
  return { type: "root", children };
}

function text(value: string): Text {
  return { type: "text", value };
}

function runPlugin(tree: Root): void {
  const plugin = rehypeImageEnlarge();
  plugin(tree);
}

describe("rehypeImageEnlarge", () => {
  it("Case A — block image: <p><img></p> → figure.zd-enlargeable wrapping img + button", () => {
    const img = makeImg();
    const tree = makeTree(makeP(img));
    runPlugin(tree);
    const figure = tree.children[0] as Element;
    expect(figure.tagName).toBe("figure");
    expect(figure.properties?.className).toContain("zd-enlargeable");
    expect((figure.children[0] as Element).tagName).toBe("img");
    expect((figure.children[1] as Element).tagName).toBe("button");
    expect((figure.children[1] as Element).properties?.hidden).toBe(true);
  });

  it("Case A + whitespace: <p>\\n  <img>\\n</p> treated as block image", () => {
    const img = makeImg();
    const tree = makeTree(makeP(text("\n  "), img, text("\n")));
    runPlugin(tree);
    expect((tree.children[0] as Element).tagName).toBe("figure");
  });

  it("Case B — inline in paragraph: <p>text <img> more</p> → unchanged", () => {
    const img = makeImg();
    const tree = makeTree(makeP(text("text "), img, text(" more")));
    runPlugin(tree);
    expect((tree.children[0] as Element).tagName).toBe("p");
  });

  it("Case B — inline in heading: <h2><img></h2> → unchanged", () => {
    const img = makeImg();
    const h2: Element = {
      type: "element",
      tagName: "h2",
      properties: {},
      children: [img],
    };
    const tree = makeTree(h2);
    runPlugin(tree);
    expect((tree.children[0] as Element).tagName).toBe("h2");
  });

  it("Case C — linked: <p><a><img></a></p> → unchanged", () => {
    const img = makeImg();
    const a: Element = {
      type: "element",
      tagName: "a",
      properties: {},
      children: [img],
    };
    const tree = makeTree(makeP(a));
    runPlugin(tree);
    expect((tree.children[0] as Element).tagName).toBe("p");
  });

  it("Case D — picture: <p><picture><img></picture></p> → unchanged", () => {
    const img = makeImg();
    const picture: Element = {
      type: "element",
      tagName: "picture",
      properties: {},
      children: [img],
    };
    const tree = makeTree(makeP(picture));
    runPlugin(tree);
    expect((tree.children[0] as Element).tagName).toBe("p");
  });

  it('Opt-out exact: <p><img title="no-enlarge"></p> → no wrap AND title attr removed', () => {
    const img = makeImg({ title: "no-enlarge" });
    const tree = makeTree(makeP(img));
    runPlugin(tree);
    expect((tree.children[0] as Element).tagName).toBe("p");
    expect(img.properties?.title).toBeUndefined();
  });

  it('Opt-out loose NOT triggered: <p><img title="no-enlarge-extra"></p> → wrapped normally', () => {
    const img = makeImg({ title: "no-enlarge-extra" });
    const tree = makeTree(makeP(img));
    runPlugin(tree);
    expect((tree.children[0] as Element).tagName).toBe("figure");
  });

  it("Idempotency pre-transform: already-wrapped figure unchanged on rerun", () => {
    const img = makeImg();
    const button: Element = {
      type: "element",
      tagName: "button",
      properties: {},
      children: [],
    };
    const figure: Element = {
      type: "element",
      tagName: "figure",
      properties: { className: ["zd-enlargeable"] },
      children: [img, button],
    };
    const tree = makeTree(figure);
    runPlugin(tree);
    expect(tree.children[0]).toBe(figure);
    expect((tree.children[0] as Element).children).toHaveLength(2);
  });

  it("Idempotency across runs: second run does NOT add second figure/button", () => {
    const img = makeImg();
    const tree = makeTree(makeP(img));
    runPlugin(tree);
    runPlugin(tree);
    const topLevel = tree.children[0] as Element;
    expect(topLevel.tagName).toBe("figure");
    expect(topLevel.children).toHaveLength(2);
  });

  it("Attributes preserved: src, alt, width, height, srcSet, sizes, className, data-*", () => {
    const img = makeImg({
      src: "/img/photo.jpg",
      alt: "A photo",
      width: 800,
      height: 600,
      srcSet: "/img/photo@2x.jpg 2x",
      sizes: "(max-width: 800px) 100vw, 800px",
      className: ["my-img"],
      dataFoo: "bar",
    });
    const tree = makeTree(makeP(img));
    runPlugin(tree);
    const resultImg = (tree.children[0] as Element).children[0] as Element;
    expect(resultImg.properties?.src).toBe("/img/photo.jpg");
    expect(resultImg.properties?.alt).toBe("A photo");
    expect(resultImg.properties?.width).toBe(800);
    expect(resultImg.properties?.height).toBe(600);
    expect(resultImg.properties?.srcSet).toBe("/img/photo@2x.jpg 2x");
    expect(resultImg.properties?.sizes).toBe("(max-width: 800px) 100vw, 800px");
    expect(resultImg.properties?.className).toContain("my-img");
    expect(resultImg.properties?.dataFoo).toBe("bar");
  });

  it("Button shape: type='button', hidden, aria-label, SVG child present", () => {
    const img = makeImg();
    const tree = makeTree(makeP(img));
    runPlugin(tree);
    const figure = tree.children[0] as Element;
    const button = figure.children[1] as Element;
    expect(button.tagName).toBe("button");
    expect(button.properties?.type).toBe("button");
    expect(button.properties?.hidden).toBe(true);
    expect(button.properties?.ariaLabel).toBeTruthy();
    expect(
      button.children.some((c) => (c as Element).tagName === "svg"),
    ).toBe(true);
  });
});
