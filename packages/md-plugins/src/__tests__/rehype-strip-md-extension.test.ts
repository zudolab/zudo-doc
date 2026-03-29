import { describe, it, expect } from "vitest";
import type { Root, Element } from "hast";
import { rehypeStripMdExtension } from "../rehype-strip-md-extension";

function makeAnchor(href: string): Element {
  return {
    type: "element",
    tagName: "a",
    properties: { href },
    children: [{ type: "text", value: "link" }],
  };
}

function makeTree(...anchors: Element[]): Root {
  return {
    type: "root",
    children: anchors,
  };
}

function processHref(href: string): string {
  const anchor = makeAnchor(href);
  const tree = makeTree(anchor);
  const plugin = rehypeStripMdExtension();
  plugin(tree);
  return anchor.properties.href as string;
}

describe("rehypeStripMdExtension", () => {
  describe("strips .md/.mdx and adds trailing slash", () => {
    it("./other-doc.md → ./other-doc/", () => {
      expect(processHref("./other-doc.md")).toBe("./other-doc/");
    });

    it("./other-doc.mdx → ./other-doc/", () => {
      expect(processHref("./other-doc.mdx")).toBe("./other-doc/");
    });

    it("./other-doc.md#section → ./other-doc/#section", () => {
      expect(processHref("./other-doc.md#section")).toBe(
        "./other-doc/#section",
      );
    });

    it("../guides/setup.md → ../guides/setup/", () => {
      expect(processHref("../guides/setup.md")).toBe("../guides/setup/");
    });
  });

  describe("adds trailing slash when Astro already stripped .md", () => {
    it("./other-doc → ./other-doc/", () => {
      expect(processHref("./other-doc")).toBe("./other-doc/");
    });

    it("./other-doc#section → ./other-doc/#section", () => {
      expect(processHref("./other-doc#section")).toBe("./other-doc/#section");
    });

    it("../guides/setup → ../guides/setup/", () => {
      expect(processHref("../guides/setup")).toBe("../guides/setup/");
    });

    it("./other-doc?tab=api → ./other-doc/?tab=api", () => {
      expect(processHref("./other-doc?tab=api")).toBe("./other-doc/?tab=api");
    });

    it("./other-doc?tab=api#section → ./other-doc/?tab=api#section", () => {
      expect(processHref("./other-doc?tab=api#section")).toBe(
        "./other-doc/?tab=api#section",
      );
    });
  });

  describe("does not modify links that should stay unchanged", () => {
    it("preserves file extensions like .png", () => {
      expect(processHref("./image.png")).toBe("./image.png");
    });

    it("does not modify external links", () => {
      expect(processHref("https://example.com")).toBe("https://example.com");
    });

    it("does not modify anchor-only links", () => {
      expect(processHref("#section")).toBe("#section");
    });

    it("does not modify absolute paths", () => {
      expect(processHref("/absolute/path")).toBe("/absolute/path");
    });

    it("does not modify relative links already with trailing slash", () => {
      expect(processHref("./dir/")).toBe("./dir/");
    });

    it("does not modify mailto links", () => {
      expect(processHref("mailto:test@example.com")).toBe(
        "mailto:test@example.com",
      );
    });
  });
});
