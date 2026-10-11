import { test, expect } from "@playwright/test";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import { makeDistReader } from "./dist-helper";

const { readDistFile } = makeDistReader("sidebar");

test("built desktop and mobile islands omit descriptions while server category content retains them", () => {
  // This existing fixture has authored descriptions and note metadata. Reading
  // real build output catches transport/bundler changes beyond source-unit SSR.
  const html = readDistFile("docs/notes/index.html");
  const articleText: string[] = [];
  const islands: Array<{ component: string; props: Record<string, unknown> }> = [];
  function walk(node: DefaultTreeAdapterMap["node"], insideMain = false): void {
    if ("tagName" in node && (node.tagName === "script" || node.tagName === "style")) return;
    const inMain = insideMain || ("tagName" in node && node.tagName === "main");
    if (inMain && node.nodeName === "#text" && "value" in node) articleText.push(node.value);
    if ("attrs" in node) {
      const attrs = Object.fromEntries(node.attrs.map(({ name, value }) => [name, value]));
      const component = attrs["data-zfb-island"];
      if (component === "SidebarTree" || component === "SidebarToggle") {
        expect(attrs["data-props"]).toBeDefined();
        islands.push({ component, props: JSON.parse(attrs["data-props"]!) });
      }
    }
    if ("childNodes" in node) node.childNodes.forEach((child) => walk(child, inMain));
  }
  walk(parse(html));
  expect(articleText.join(" ")).toContain("The first note in the tray.");
  expect(islands.map(({ component }) => component).sort()).toEqual(["SidebarToggle", "SidebarTree"]);
  for (const { props } of islands) {
    const nodes = props.nodes as Array<Record<string, unknown>>;
    const navigation = props.navigation as { roots: Array<Record<string, unknown>>; id: string; parents: Record<string, string | null> };
    expect(nodes.length).toBeGreaterThan(0);
    expect(navigation.roots.length).toBeGreaterThan(nodes.length);
    expect(navigation.id).toBeTruthy();
    expect(Object.keys(navigation.parents).length).toBeGreaterThan(0);
    function assertMinimal(node: Record<string, unknown>): void {
      expect(node).not.toHaveProperty("description");
      expect(node.slug).toEqual(expect.any(String));
      expect(node.label).toEqual(expect.any(String));
      expect(node.occurrenceId).toEqual(expect.any(String));
      (node.children as Array<Record<string, unknown>>).forEach(assertMinimal);
    }
    nodes.forEach(assertMinimal);
    navigation.roots.forEach(assertMinimal);
    expect(JSON.stringify(props)).not.toContain("The first note in the tray.");
    expect(JSON.stringify(props)).not.toContain("The latest journal entry.");
  }
});
