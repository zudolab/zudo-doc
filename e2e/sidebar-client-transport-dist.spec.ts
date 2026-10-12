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

test("built node-mode baseline serializes the linked section root and full ancestry identically for both islands", () => {
  const html = readDistFile("docs/wind/utility/surfaces/background/index.html");
  const islands: Array<{ component: string; props: Record<string, unknown> }> = [];
  function walk(node: DefaultTreeAdapterMap["node"]): void {
    if ("attrs" in node) {
      const attrs = Object.fromEntries(node.attrs.map(({ name, value }) => [name, value]));
      const component = attrs["data-zfb-island"];
      if (component === "SidebarTree" || component === "SidebarToggle") islands.push({ component, props: JSON.parse(attrs["data-props"]!) });
    }
    if ("childNodes" in node) node.childNodes.forEach(walk);
  }
  walk(parse(html));
  expect(islands.map(({ component }) => component).sort()).toEqual(["SidebarToggle", "SidebarTree"]);
  type Node = { slug: string; href?: string; occurrenceId: string; children: Node[] };
  const [desktop, mobile] = ["SidebarTree", "SidebarToggle"].map((name) => islands.find(({ component }) => component === name)!.props as {
    nodes: Node[]; navigation: { id: string; roots: Node[]; parents: Record<string, string | null>; localParentId?: string };
  });
  expect({ nodes: mobile!.nodes, navigation: mobile!.navigation }).toEqual({ nodes: desktop!.nodes, navigation: desktop!.navigation });
  const { nodes, navigation } = desktop!;
  expect(nodes).toHaveLength(1);
  expect(nodes[0]!.slug).toBe("wind/utility/surfaces");
  expect(nodes[0]!.href).toMatch(/\/docs\/wind\/utility\/surfaces\/?$/);
  expect(nodes[0]!.children.map((child) => child.slug)).toEqual(["wind/utility/surfaces/background", "wind/utility/surfaces/border"]);
  const utility = navigation.parents[nodes[0]!.occurrenceId]!;
  expect(navigation.localParentId).toBe(utility);
  const wind = navigation.roots.find((root) => root.slug === "wind")!;
  expect(navigation.parents[utility]).toBe(wind.occurrenceId);
  expect(navigation.parents[wind.occurrenceId]).toBeNull();
  expect(JSON.stringify(desktop)).not.toContain("kept out of sidebar client props");
  expect(JSON.stringify(desktop)).not.toContain('"description"');
});
