import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";
import type { Root, Link, Paragraph, Definition } from "mdast";
import { remarkResolveMarkdownLinks } from "../remark-resolve-markdown-links";
import { createTempProject, touch, cleanupTempProject } from "./test-helpers";

function makeLink(url: string): Link {
  return { type: "link", url, children: [{ type: "text", value: "link" }] };
}

function makeDefinition(url: string): Definition {
  return { type: "definition", url, identifier: "ref", label: "ref" };
}

function makeTree(...links: (Link | Definition)[]): Root {
  return {
    type: "root",
    children: links.map((link) =>
      link.type === "definition"
        ? link
        : ({
            type: "paragraph",
            children: [link],
          } as Paragraph),
    ),
  };
}

describe("remarkResolveMarkdownLinks", () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = createTempProject();
  });

  afterEach(() => {
    cleanupTempProject(rootDir);
  });

  function baseOptions() {
    return {
      rootDir,
      docsDir: "src/content/docs",
      locales: {} as Record<string, { dir: string }>,
      versions: false as const,
      base: "/",
      trailingSlash: true,
    };
  }

  it("resolves a relative .mdx link to a URL", () => {
    touch(rootDir, "src/content/docs/guides/getting-started.mdx");
    touch(rootDir, "src/content/docs/guides/other-doc.mdx");

    const link = makeLink("./other-doc.mdx");
    const tree = makeTree(link);
    const file = {
      path: resolve(rootDir, "src/content/docs/guides/getting-started.mdx"),
    };

    const plugin = remarkResolveMarkdownLinks(baseOptions());
    plugin(tree, file);

    expect(link.url).toBe("/docs/guides/other-doc/");
  });

  it("resolves a parent-directory .md link", () => {
    touch(rootDir, "src/content/docs/guides/sidebar.md");
    touch(rootDir, "src/content/docs/guides/sub/page.mdx");

    const link = makeLink("../sidebar.md");
    const tree = makeTree(link);
    const file = {
      path: resolve(rootDir, "src/content/docs/guides/sub/page.mdx"),
    };

    const plugin = remarkResolveMarkdownLinks(baseOptions());
    plugin(tree, file);

    expect(link.url).toBe("/docs/guides/sidebar/");
  });

  it("preserves hash fragment", () => {
    touch(rootDir, "src/content/docs/guides/other-doc.md");
    touch(rootDir, "src/content/docs/guides/current.mdx");

    const link = makeLink("./other-doc.md#section");
    const tree = makeTree(link);
    const file = {
      path: resolve(rootDir, "src/content/docs/guides/current.mdx"),
    };

    const plugin = remarkResolveMarkdownLinks(baseOptions());
    plugin(tree, file);

    expect(link.url).toBe("/docs/guides/other-doc/#section");
  });

  it("preserves query string", () => {
    touch(rootDir, "src/content/docs/guides/other-doc.md");
    touch(rootDir, "src/content/docs/guides/current.mdx");

    const link = makeLink("./other-doc.md?query=1");
    const tree = makeTree(link);
    const file = {
      path: resolve(rootDir, "src/content/docs/guides/current.mdx"),
    };

    const plugin = remarkResolveMarkdownLinks(baseOptions());
    plugin(tree, file);

    expect(link.url).toBe("/docs/guides/other-doc/?query=1");
  });

  it("preserves combined query string and hash", () => {
    touch(rootDir, "src/content/docs/guides/other-doc.md");
    touch(rootDir, "src/content/docs/guides/current.mdx");

    const link = makeLink("./other-doc.md?version=2#section");
    const tree = makeTree(link);
    const file = {
      path: resolve(rootDir, "src/content/docs/guides/current.mdx"),
    };

    const plugin = remarkResolveMarkdownLinks(baseOptions());
    plugin(tree, file);

    expect(link.url).toBe("/docs/guides/other-doc/?version=2#section");
  });

  it("does not modify external links", () => {
    const link = makeLink("https://example.com/page.md");
    const tree = makeTree(link);
    const file = {
      path: resolve(rootDir, "src/content/docs/guides/current.mdx"),
    };

    const plugin = remarkResolveMarkdownLinks(baseOptions());
    plugin(tree, file);

    expect(link.url).toBe("https://example.com/page.md");
  });

  it("does not modify pure anchor links", () => {
    const link = makeLink("#heading");
    const tree = makeTree(link);
    const file = {
      path: resolve(rootDir, "src/content/docs/guides/current.mdx"),
    };

    const plugin = remarkResolveMarkdownLinks(baseOptions());
    plugin(tree, file);

    expect(link.url).toBe("#heading");
  });

  it("does not modify non-markdown links", () => {
    const link = makeLink("./image.png");
    const tree = makeTree(link);
    const file = {
      path: resolve(rootDir, "src/content/docs/guides/current.mdx"),
    };

    const plugin = remarkResolveMarkdownLinks(baseOptions());
    plugin(tree, file);

    expect(link.url).toBe("./image.png");
  });

  it("warns on broken link by default", () => {
    touch(rootDir, "src/content/docs/guides/current.mdx");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const link = makeLink("./nonexistent.md");
    const tree = makeTree(link);
    const file = {
      path: resolve(rootDir, "src/content/docs/guides/current.mdx"),
    };

    const plugin = remarkResolveMarkdownLinks(baseOptions());
    plugin(tree, file);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Broken markdown link"),
    );
    warnSpy.mockRestore();
  });

  it("throws on broken link with onBrokenLinks: 'error'", () => {
    touch(rootDir, "src/content/docs/guides/current.mdx");

    const link = makeLink("./nonexistent.md");
    const tree = makeTree(link);
    const file = {
      path: resolve(rootDir, "src/content/docs/guides/current.mdx"),
    };

    const plugin = remarkResolveMarkdownLinks({
      ...baseOptions(),
      onBrokenLinks: "error",
    });

    expect(() => plugin(tree, file)).toThrow("Broken markdown link");
  });

  it("silently ignores broken link with onBrokenLinks: 'ignore'", () => {
    touch(rootDir, "src/content/docs/guides/current.mdx");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const link = makeLink("./nonexistent.md");
    const tree = makeTree(link);
    const file = {
      path: resolve(rootDir, "src/content/docs/guides/current.mdx"),
    };

    const plugin = remarkResolveMarkdownLinks({
      ...baseOptions(),
      onBrokenLinks: "ignore",
    });
    plugin(tree, file);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(link.url).toBe("./nonexistent.md");
    warnSpy.mockRestore();
  });

  it("resolves definition node URLs", () => {
    touch(rootDir, "src/content/docs/guides/other-doc.mdx");
    touch(rootDir, "src/content/docs/guides/current.mdx");

    const def = makeDefinition("./other-doc.mdx");
    const tree = makeTree(def);
    const file = {
      path: resolve(rootDir, "src/content/docs/guides/current.mdx"),
    };

    const plugin = remarkResolveMarkdownLinks(baseOptions());
    plugin(tree, file);

    expect(def.url).toBe("/docs/guides/other-doc/");
  });

  describe("non-default configs", () => {
    it("resolves links with custom base path", () => {
      touch(rootDir, "src/content/docs/guides/getting-started.mdx");
      touch(rootDir, "src/content/docs/guides/other-doc.mdx");

      const link = makeLink("./other-doc.mdx");
      const tree = makeTree(link);
      const file = {
        path: resolve(rootDir, "src/content/docs/guides/getting-started.mdx"),
      };

      const plugin = remarkResolveMarkdownLinks({
        ...baseOptions(),
        base: "/pj/zudo-doc/",
      });
      plugin(tree, file);

      expect(link.url).toBe("/pj/zudo-doc/docs/guides/other-doc/");
    });

    it("resolves cross-locale links from Japanese docs", () => {
      touch(rootDir, "src/content/docs-ja/guides/getting-started.mdx");
      touch(rootDir, "src/content/docs-ja/guides/other-doc.mdx");

      const link = makeLink("./other-doc.mdx");
      const tree = makeTree(link);
      const file = {
        path: resolve(
          rootDir,
          "src/content/docs-ja/guides/getting-started.mdx",
        ),
      };

      const plugin = remarkResolveMarkdownLinks({
        ...baseOptions(),
        locales: { ja: { dir: "src/content/docs-ja" } },
      });
      plugin(tree, file);

      expect(link.url).toBe("/ja/docs/guides/other-doc/");
    });

    it("resolves links in versioned docs", () => {
      touch(rootDir, "src/content/docs-v1/guides/getting-started.mdx");
      touch(rootDir, "src/content/docs-v1/guides/other-doc.mdx");

      const link = makeLink("./other-doc.mdx");
      const tree = makeTree(link);
      const file = {
        path: resolve(
          rootDir,
          "src/content/docs-v1/guides/getting-started.mdx",
        ),
      };

      const plugin = remarkResolveMarkdownLinks({
        ...baseOptions(),
        versions: [{ slug: "1.0", docsDir: "src/content/docs-v1" }],
      });
      plugin(tree, file);

      expect(link.url).toBe("/v/1.0/docs/guides/other-doc/");
    });

    it("does not resolve URL-encoded links to files with spaces", () => {
      touch(rootDir, "src/content/docs/guides/my doc.mdx");
      touch(rootDir, "src/content/docs/guides/current.mdx");

      const link = makeLink("./my%20doc.mdx");
      const tree = makeTree(link);
      const file = {
        path: resolve(rootDir, "src/content/docs/guides/current.mdx"),
      };

      // %20 is not decoded, so the link won't match "my doc.mdx"
      const plugin = remarkResolveMarkdownLinks({
        ...baseOptions(),
        onBrokenLinks: "ignore",
      });
      plugin(tree, file);

      expect(link.url).toBe("./my%20doc.mdx");
    });

    it("resolves links with spaces to files with spaces", () => {
      touch(rootDir, "src/content/docs/guides/my doc.mdx");
      touch(rootDir, "src/content/docs/guides/current.mdx");

      const link = makeLink("./my doc.mdx");
      const tree = makeTree(link);
      const file = {
        path: resolve(rootDir, "src/content/docs/guides/current.mdx"),
      };

      const plugin = remarkResolveMarkdownLinks(baseOptions());
      plugin(tree, file);

      expect(link.url).toBe("/docs/guides/my doc/");
    });
  });
});
