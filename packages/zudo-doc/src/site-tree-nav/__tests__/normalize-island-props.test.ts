import { describe, expect, it } from "vitest";
import { normalizeSiteTreeNavProps } from "../normalize-island-props.js";
import type { SidebarNavNode } from "../../sidebar/types.js";

describe("normalizeSiteTreeNavProps", () => {
  it("copies the tree and omits absent optional keys at every depth", () => {
    const sourceTree: SidebarNavNode[] = [{
      slug: "guide",
      label: "Guide",
      position: 1,
      hasPage: true,
      description: undefined,
      href: "/docs/guide",
      collapsed: false,
      children: [{
        slug: "guide/setup",
        label: "Setup",
        position: 2,
        hasPage: true,
        description: undefined,
        children: [],
      }],
    }];
    const sourceCategoryOrder = ["guide"];
    const result = normalizeSiteTreeNavProps({
      tree: sourceTree,
      categoryOrder: sourceCategoryOrder,
      locale: "ja",
      dateFormats: {
        full: "locale",
        monthDay: "locale",
        year: "locale",
        yearMonth: "locale",
        numericMonthDay: "locale",
      },
    });

    expect(result).toEqual({
      tree: [{
        slug: "guide",
        label: "Guide",
        position: 1,
        hasPage: true,
        href: "/docs/guide",
        collapsed: false,
        children: [{
          slug: "guide/setup",
          label: "Setup",
          position: 2,
          hasPage: true,
          children: [],
        }],
      }],
      categoryOrder: ["guide"],
      locale: "ja",
      dateFormats: {
        full: "locale",
        monthDay: "locale",
        year: "locale",
        yearMonth: "locale",
        numericMonthDay: "locale",
      },
    });
    expect(Object.hasOwn(result, "categoryIgnore")).toBe(false);
    expect(Object.hasOwn(result.tree[0]!, "description")).toBe(false);
    expect(Object.hasOwn(result.tree[0]!.children[0]!, "description")).toBe(false);
    expect(result.tree).not.toBe(sourceTree);
    expect(result.categoryOrder).not.toBe(sourceCategoryOrder);
    expect(Object.hasOwn(sourceTree[0]!, "description")).toBe(true);
  });

  it("copies defined optional props and rejects non-finite numeric data", () => {
    const tree: SidebarNavNode[] = [{
      slug: "notes",
      label: "Notes",
      position: 3,
      hasPage: true,
      shape: "note-tray",
      noteTrayDated: true,
      rank: 4,
      children: [],
    }];
    const result = normalizeSiteTreeNavProps({
      tree,
      categoryOrder: ["notes"],
      categoryIgnore: ["hidden"],
      ariaLabel: "Site index",
      locale: "en",
      dateFormats: {
        full: "locale",
        monthDay: "locale",
        year: "locale",
        yearMonth: "locale",
        numericMonthDay: "locale",
      },
    });
    expect(result.categoryIgnore).toEqual(["hidden"]);
    expect(result.ariaLabel).toBe("Site index");
    expect(result.tree[0]).toMatchObject({ shape: "note-tray", noteTrayDated: true, rank: 4 });

    expect(() => normalizeSiteTreeNavProps({
      tree: [{ ...tree[0]!, position: Number.NaN }],
      categoryOrder: [],
      locale: "en",
      dateFormats: result.dateFormats,
    })).toThrow(/position must be finite/);
  });

  it("rejects cyclic nav data before it reaches Island props", () => {
    const cycle: SidebarNavNode = {
      slug: "guide",
      label: "Guide",
      position: 1,
      hasPage: true,
      children: [],
    };
    cycle.children.push(cycle);

    expect(() => normalizeSiteTreeNavProps({
      tree: [cycle],
      categoryOrder: [],
      locale: "en",
      dateFormats: {
        full: "locale",
        monthDay: "locale",
        year: "locale",
        yearMonth: "locale",
        numericMonthDay: "locale",
      },
    })).toThrow(/must not contain cycles/);
  });
});
