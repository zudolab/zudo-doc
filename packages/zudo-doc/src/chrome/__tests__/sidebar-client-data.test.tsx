/** @jsxRuntime automatic */
import "../../__tests__/fixtures/install-island-metadata.js";
import { describe, expect, it } from "vitest";
import type { Description } from "@takazudo/zfb/zudo-react";
import { renderSsr } from "../../__tests__/helpers/zudo-react.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import { createSidebarWithDefaults } from "../../sidebar-with-defaults/index.js";
import { createHeaderWithDefaults } from "../../header-with-defaults/index.js";
import { deriveNavDataPrep } from "../derive.js";
import { toSidebarClientData } from "../../sidebar/client-data.js";
import type { SidebarNavNode } from "../../sidebar/types.js";

const sentinel = "PUBLIC_SIBLING_DESCRIPTION_SENTINEL_155";
const nodes: SidebarNavNode[] = ["guides", "other"].map((slug, position) => ({
  slug, label: slug, position, hasPage: true, href: `/docs/${slug}/`, description: sentinel,
  children: [{ slug: `${slug}/one`, label: "One", position: 0, hasPage: true,
    href: `/docs/${slug}/one/`, description: sentinel, children: [] }],
}));
function decode(html: string) {
  const encoded = /data-props="([^"]*)"/.exec(html)?.[1];
  expect(encoded).toBeDefined();
  return JSON.parse(encoded!.replaceAll("&quot;", '"').replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">").replaceAll("&#39;", "'").replaceAll("&amp;", "&"));
}

describe("native sidebar transport boundaries", () => {
  for (const path of ["desktop", "mobile"] as const) {
    it(`${path} removes descriptions from visible and broader serialized roots, retaining server data`, () => {
      const ctx = makeFakeChromeContext({ overrides: { buildNavTree: () => nodes } });
      const input = { navSection: "guides", currentSlug: "guides/one", currentVersion: "2" };
      const server = deriveNavDataPrep(ctx).buildSidebarContext("en", "guides", "2", false);
      expect(server.navigation?.roots[1]?.children[0]?.description).toBe(sentinel);
      const vnode = path === "desktop" ? createSidebarWithDefaults(ctx)(input)
        : (createHeaderWithDefaults(ctx)(input) as Description).props["sidebarToggle"] as Description;
      const html = renderSsr(vnode);
      expect(html).toContain(`data-zfb-island="${path === "desktop" ? "SidebarTree" : "SidebarToggle"}"`);
      expect(html).not.toContain(sentinel);
      const props = decode(html);
      expect({ nodes: props.nodes, navigation: props.navigation }).toEqual(toSidebarClientData(server.nodes, server.navigation));
      expect(props.navigation.roots).toHaveLength(2);
      expect(props.nodes).toHaveLength(1);
      expect(nodes[1]?.children[0]?.description).toBe(sentinel);
    });
  }

  for (const mode of ["array", "callback"] as const) {
    it(`${mode} custom mobile forest preserves URLs, duplicate occurrences and note metadata`, () => {
      const custom = [0, 1].map((i) => ({ ...nodes[0]!, occurrenceId: `custom/${i}`,
        href: "/v/2/docs/guides/", shape: "note-tray" as const, noteTrayDated: true,
        noteTraySidebar: "month" as const, date: "2026-10-11", rank: i, collapsed: true }));
      const before = structuredClone(custom);
      const header = createHeaderWithDefaults(makeFakeChromeContext())({ sidebarNodes: mode === "array" ? custom : () => custom }) as Description;
      const html = renderSsr(header.props["sidebarToggle"] as Description);
      expect(html).not.toContain(sentinel);
      expect(decode(html).nodes).toEqual(toSidebarClientData(custom).nodes);
      expect(custom).toEqual(before);
    });
  }

  it("does not validate a custom tree when no mobile island is constructed", () => {
    const invalid = [{ ...nodes[0]! }];
    Object.assign(invalid[0]!, { description: () => sentinel });
    const Header = createHeaderWithDefaults(makeFakeChromeContext());
    expect(() => Header({ sidebarNodes: invalid })).toThrow(/island/);
    expect((Header({ sidebarNodes: invalid, hideSidebarToggle: true }) as Description).props["sidebarToggle"]).toBe(false);
  });
});
