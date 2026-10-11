import { describe, expect, it } from "vitest";
import { toSidebarClientData } from "../client-data.js";
import type { SidebarNavNode, SidebarNavigationContext } from "../types.js";

const prose = "PUBLIC_SIBLING_DESCRIPTION_SENTINEL_155";
const leaf: SidebarNavNode = {
  occurrenceId: "custom/0/0", slug: "notes/one", label: "One", description: prose,
  position: 4, href: "/v/2/docs/notes/one/", hasPage: true, children: [],
  sortOrder: "desc", collapsed: false, shape: "note-tray", noteTrayDated: true,
  noteTraySidebar: "month", date: "2026-10-10", updated: "2026-10-11", rank: 3,
};

describe("minimal sidebar transport", () => {
  it("retains every client field and occurrence in authored order without mutating server data", () => {
    const nodes = [{ ...leaf, children: [{ ...leaf, occurrenceId: "custom/0/0/0" }] }];
    const navigation: SidebarNavigationContext = {
      id: "source-topology-id", roots: [...nodes, { ...leaf, occurrenceId: "custom/1" }],
      parents: { "custom/0/0": null, "custom/0/0/0": "custom/0/0", "custom/1": null },
      initialExpansion: { "custom/0/0": "expanded" }, localParentId: "custom/0/0",
    };
    const before = structuredClone({ nodes, navigation });
    const actual = toSidebarClientData(nodes, navigation);
    const { description: _description, ...expected } = leaf;
    expect(actual.nodes).toEqual([{ ...expected, children: [{ ...expected, occurrenceId: "custom/0/0/0" }] }]);
    expect(actual.navigation).toEqual({ ...navigation, roots: [...actual.nodes, { ...expected, occurrenceId: "custom/1" }] });
    expect(JSON.stringify(actual)).not.toContain(prose);
    expect({ nodes, navigation }).toEqual(before);
    expect(actual.nodes).not.toBe(nodes);
    expect(actual.navigation?.parents).not.toBe(navigation.parents);
    expect(actual.navigation?.id).toBe(navigation.id);
  });

  it("omits unknown prose and undefined optional fields without introducing navigation", () => {
    const node = { ...leaf, description: undefined, extraProse: prose, href: undefined };
    const actual = toSidebarClientData([node]);
    expect(actual).not.toHaveProperty("navigation");
    expect(actual.nodes[0]).not.toHaveProperty("description");
    expect(actual.nodes[0]).not.toHaveProperty("extraProse");
    expect(actual.nodes[0]).not.toHaveProperty("href");
  });

  it.each(["accessor", "cycle", "function", "sparse", "undefined-array"])(
    "rejects malformed discarded fields before projection: %s", (kind) => {
      const node = { ...leaf };
      if (kind === "accessor") Object.defineProperty(node, "description", { get: () => { throw new Error("getter invoked"); } });
      if (kind === "cycle") Object.assign(node, { description: node });
      if (kind === "function") Object.assign(node, { description: () => prose });
      if (kind === "sparse") Object.assign(node, { description: new Array(1) });
      if (kind === "undefined-array") Object.assign(node, { description: [undefined] });
      expect(() => toSidebarClientData([node])).toThrow(/island/);
      expect(() => toSidebarClientData([], { id: "hidden", roots: [node], parents: {} })).toThrow(/island/);
    },
  );
});
