import { describe, expect, it } from "vitest";
import plugin from "../optional-peers.js";

function setupWith(options: Record<string, unknown>): Map<string, string> {
  const modules = new Map<string, string>();
  const ctx = {
    options,
    addVirtualModule(specifier: string, loader: () => string) {
      modules.set(specifier, loader());
    },
  };
  plugin.setup?.(ctx as unknown as Parameters<NonNullable<typeof plugin.setup>>[0]);
  return modules;
}

describe("optional-peers plugin", () => {
  it("shadows each listed peer with a module that throws on evaluation", () => {
    const modules = setupWith({ shadow: ["katex", "diff"] });
    expect([...modules.keys()]).toEqual(["katex", "diff"]);
    expect(modules.get("diff")).toMatch(/^throw new Error\("Optional peer \\"diff\\" is shadowed/);
    expect(modules.get("diff")).toContain("export {};");
  });

  it("shadows a feature-on peer only when it cannot be resolved", () => {
    const modules = setupWith({ shadowIfMissing: ["diff", "not-installed-optional-peer"] });
    expect([...modules.keys()]).toEqual(["not-installed-optional-peer"]);
  });

  it("registers nothing without peer lists", () => {
    expect(setupWith({}).size).toBe(0);
  });
});
