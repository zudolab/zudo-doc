import { describe, it, expect } from "vitest";
import type { Root, Element, ElementContent, Text, Properties } from "hast";
import { rehypeImageEnlarge } from "../rehype-image-enlarge";

function makeImg(props: Properties = {}): Element {
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
    expect(figure.children).toHaveLength(2);
    expect((figure.children[0] as Element).tagName).toBe("img");
    expect((figure.children[1] as Element).tagName).toBe("button");
    expect((figure.children[1] as Element).properties?.hidden).toBe(true);
  });

  it("Case A + whitespace: <p>\\n  <img>\\n</p> treated as block image", () => {
    const img = makeImg();
    const tree = makeTree(makeP(text("\n  "), img, text("\n")));
    runPlugin(tree);
    const figure = tree.children[0] as Element;
    expect(figure.tagName).toBe("figure");
    expect(figure.properties?.className).toContain("zd-enlargeable");
    expect((figure.children[0] as Element).tagName).toBe("img");
    expect((figure.children[1] as Element).tagName).toBe("button");
  });

  it("Case B — inline in paragraph: <p>text <img> more</p> → unchanged", () => {
    const img = makeImg();
    const t1 = text("text ");
    const t2 = text(" more");
    const p = makeP(t1, img, t2);
    const tree = makeTree(p);
    runPlugin(tree);
    expect((tree.children[0] as Element).tagName).toBe("p");
    expect(p.children).toHaveLength(3);
    expect(p.children[1]).toBe(img);
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
    expect(h2.children[0]).toBe(img);
  });

  it("Case C — linked: <p><a><img></a></p> → unchanged", () => {
    const img = makeImg();
    const a: Element = {
      type: "element",
      tagName: "a",
      properties: {},
      children: [img],
    };
    const p = makeP(a);
    const tree = makeTree(p);
    runPlugin(tree);
    expect((tree.children[0] as Element).tagName).toBe("p");
    expect(p.children[0]).toBe(a);
    expect(a.children[0]).toBe(img);
  });

  it("Case D — picture: <p><picture><img></picture></p> → unchanged", () => {
    const img = makeImg();
    const picture: Element = {
      type: "element",
      tagName: "picture",
      properties: {},
      children: [img],
    };
    const p = makeP(picture);
    const tree = makeTree(p);
    runPlugin(tree);
    expect((tree.children[0] as Element).tagName).toBe("p");
    expect(p.children[0]).toBe(picture);
    expect(picture.children[0]).toBe(img);
  });

  it('Opt-out exact: <p><img title="no-enlarge"></p> → no wrap AND title attr removed', () => {
    const img = makeImg({ title: "no-enlarge", src: "/x.jpg", alt: "x" });
    const tree = makeTree(makeP(img));
    runPlugin(tree);
    expect((tree.children[0] as Element).tagName).toBe("p");
    expect(img.properties?.title).toBeUndefined();
    expect(img.properties?.src).toBe("/x.jpg");
    expect(img.properties?.alt).toBe("x");
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
    expect(figure.children[0]).toBe(img);
    expect(figure.children[1]).toBe(button);
    expect(figure.children).toHaveLength(2);
  });

  it("Idempotency across runs: second run does NOT add second figure/button", () => {
    const img = makeImg();
    const tree = makeTree(makeP(img));
    runPlugin(tree);
    runPlugin(tree);
    const topLevel = tree.children[0] as Element;
    expect(topLevel.tagName).toBe("figure");
    expect(topLevel.children).toHaveLength(2);
    expect((topLevel.children[0] as Element).tagName).toBe("img");
    expect((topLevel.children[1] as Element).tagName).toBe("button");
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
    const figure = tree.children[0] as Element;
    expect(figure.tagName).toBe("figure");
    expect((figure.children[1] as Element).tagName).toBe("button");
    const resultImg = figure.children[0] as Element;
    expect(resultImg.properties?.src).toBe("/img/photo.jpg");
    expect(resultImg.properties?.alt).toBe("A photo");
    expect(resultImg.properties?.width).toBe(800);
    expect(resultImg.properties?.height).toBe(600);
    expect(resultImg.properties?.srcSet).toBe("/img/photo@2x.jpg 2x");
    expect(resultImg.properties?.sizes).toBe("(max-width: 800px) 100vw, 800px");
    expect(resultImg.properties?.className).toContain("my-img");
    expect(resultImg.properties?.dataFoo).toBe("bar");
  });

  it("Button shape: type='button', hidden, aria-label, SVG with polygon children", () => {
    const img = makeImg();
    const tree = makeTree(makeP(img));
    runPlugin(tree);
    const figure = tree.children[0] as Element;
    const button = figure.children[1] as Element;
    expect(button.tagName).toBe("button");
    expect(button.properties?.type).toBe("button");
    expect(button.properties?.hidden).toBe(true);
    expect(button.properties?.ariaLabel).toBeTruthy();
    const svg = button.children.find(
      (c) => (c as Element).tagName === "svg",
    ) as Element;
    expect(svg).toBeDefined();
    expect(svg.properties?.viewBox).toBe("0 0 38.99 38.99");
    expect(svg.properties?.fill).toBe("currentColor");
    const hasPolygon = svg.children.some(
      (c) => (c as Element).tagName === "polygon",
    );
    expect(hasPolygon).toBe(true);
  });
});
