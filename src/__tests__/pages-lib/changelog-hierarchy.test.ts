import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveDocPrevNext } from "@takazudo/zudo-doc/doc-route-paths";
import type { DocPageEntry } from "@takazudo/zudo-doc/doc-page-props";
import { settings } from "@/config/settings";
import { buildNavTree, findNode, flattenTree, type NavNode } from "@/utils/docs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const EN_CHANGELOG = join(ROOT, "src/content/docs/changelog");
const JA_CHANGELOG = join(ROOT, "src/content/docs-ja/changelog");

function mdxFiles(root: string): string[] {
  const files: string[] = [];
  function walk(dir: string): void {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, name.name);
      if (name.isDirectory()) walk(path);
      else if (name.isFile() && name.name.endsWith(".mdx")) {
        files.push(relative(root, path));
      }
    }
  }
  walk(root);
  return files.sort();
}

function frontmatter(source: string): Record<string, unknown> {
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  if (!match?.[1]) throw new Error("missing frontmatter");
  const result: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^(title|sidebar_position|sidebar_label|category_sort_order|pagination_prev|pagination_next):\s*(.*)$/);
    if (!field?.[1]) continue;
    const value = field[2]!.trim();
    result[field[1]] = value === "null" ? null : /^\d+$/.test(value) ? Number(value) : value.replace(/^['"]|['"]$/g, "");
  }
  return result;
}

function changelogEntries(root = EN_CHANGELOG): DocPageEntry[] {
  return mdxFiles(root).map((path) => {
    const slug = canonicalSlug(path);
    const source = readFileSync(join(root, path), "utf8");
    return {
      slug: path.replace(/\.mdx$/, ""),
      data: { ...frontmatter(source), slug } as DocPageEntry["data"],
      body: source,
      module_specifier: `mdx://docs/${path}`,
      Content: () => ({ type: "div", props: {}, key: null }),
    } as DocPageEntry;
  });
}

function canonicalSlug(path: string): string {
  const withoutExtension = path.replace(/\.mdx$/, "");
  const categoryPath = withoutExtension.endsWith("/index")
    ? withoutExtension.slice(0, -"/index".length)
    : withoutExtension === "index"
      ? ""
      : withoutExtension;
  return categoryPath ? `changelog/${categoryPath}` : "changelog";
}

function changelogNav(root = EN_CHANGELOG): { tree: NavNode[]; flat: NavNode[] } {
  const tree = buildNavTree(changelogEntries(root));
  const changelog = findNode(tree, "changelog");
  if (!changelog) throw new Error("missing changelog tree");
  return { tree, flat: flattenTree([changelog]) };
}

describe("showcase package changelog hierarchy", () => {
  it("keeps the bilingual package release trees aligned", () => {
    const en = mdxFiles(EN_CHANGELOG);
    const ja = mdxFiles(JA_CHANGELOG);
    expect(ja).toEqual(en);

    const releases = en.filter((path) => path !== "index.mdx" && !path.endsWith("/index.mdx"));
    expect(releases).toHaveLength(133);
    expect(releases.filter((path) => path.startsWith("zudo-doc/"))).toHaveLength(107);
    expect(releases.filter((path) => path.startsWith("create-zudo-doc/"))).toHaveLength(13);
    expect(releases.filter((path) => path.startsWith("doc-history-server/"))).toHaveLength(13);
    expect(en).toEqual([
      "create-zudo-doc/index.mdx",
      "doc-history-server/index.mdx",
      "index.mdx",
      ...releases,
      "zudo-doc/index.mdx",
    ].sort());
  });

  it("uses a root landing and newest-first package lanes", () => {
    const root = frontmatter(readFileSync(join(EN_CHANGELOG, "index.mdx"), "utf8"));
    expect(root.category_sort_order).toBeUndefined();

    for (const slug of ["zudo-doc", "create-zudo-doc", "doc-history-server"]) {
      const index = frontmatter(readFileSync(join(EN_CHANGELOG, slug, "index.mdx"), "utf8"));
      expect(index.category_sort_order).toBe("desc");
    }

    const { tree } = changelogNav();
    const zudo = findNode(tree, "changelog/zudo-doc");
    expect(zudo?.children[0]?.slug).toBe("changelog/zudo-doc/5.17.2");
    expect(zudo?.children.at(-1)?.slug).toBe("changelog/zudo-doc/0.1.0");
  });

  it("does not let the doc pager cross package boundaries", () => {
    for (const root of [EN_CHANGELOG, JA_CHANGELOG]) {
      const { tree, flat } = changelogNav(root);
      const overridesBySlug = new Map(
        mdxFiles(root).map((path) => {
          const slug = canonicalSlug(path);
          return [slug, frontmatter(readFileSync(join(root, path), "utf8"))] as const;
        }),
      );
      const resolve = (slug: string) =>
        resolveDocPrevNext(tree, flat, slug, overridesBySlug.get(slug) ?? {});

      expect(resolve("changelog").prev).toBeNull();
      expect(resolve("changelog").next).toBeNull();
      expect(resolve("changelog/zudo-doc").prev).toBeNull();
      expect(resolve("changelog/zudo-doc/0.1.0").next).toBeNull();
      expect(resolve("changelog/create-zudo-doc").prev).toBeNull();
      expect(resolve("changelog/create-zudo-doc").next).toBeNull();
      expect(resolve("changelog/doc-history-server").prev).toBeNull();
      expect(resolve("changelog/doc-history-server").next).toBeNull();
    }
  });

  it("configures one emitter and one dropdown child per published package", () => {
    expect(settings.changelogs).toEqual([
      {
        sourceDir: "src/content/docs/changelog/zudo-doc",
        outputFile: "packages/zudo-doc/CHANGELOG.md",
        packageName: "@takazudo/zudo-doc",
      },
      {
        sourceDir: "src/content/docs/changelog/create-zudo-doc",
        outputFile: "packages/create-zudo-doc/CHANGELOG.md",
        packageName: "create-zudo-doc",
      },
      {
        sourceDir: "src/content/docs/changelog/doc-history-server",
        outputFile: "packages/doc-history-server/CHANGELOG.md",
        packageName: "@takazudo/zudo-doc-history-server",
      },
    ]);

    const changelog = settings.headerNav.find((item) => item.categoryMatch === "changelog");
    expect(changelog?.path).toBe("/docs/changelog");
    expect(changelog?.children?.map(({ label, path, categoryMatch }) => ({ label, path, categoryMatch }))).toEqual([
      { label: "zudo-doc", path: "/docs/changelog/zudo-doc", categoryMatch: undefined },
      { label: "create-zudo-doc", path: "/docs/changelog/create-zudo-doc", categoryMatch: undefined },
      { label: "doc-history-server", path: "/docs/changelog/doc-history-server", categoryMatch: undefined },
    ]);
  });
});
