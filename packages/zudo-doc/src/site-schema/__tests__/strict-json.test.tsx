import { describe, expect, it } from "vitest";
import { buildNavTree } from "../nav-tree.js";
import type { DocEntryLike } from "../types.js";
import { buildSidebarTree } from "../../sidebar-tree/build-tree.js";
import { buildRootMenuItems } from "../../nav-data-prep/index.js";

/** Mirrors the strict island transport check, including keys JSON.stringify hides. */
function assertStrictJson(value: unknown, path = "$", seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object") throw new Error(`${path}: invalid ${typeof value}`);
  if (seen.has(value)) throw new Error(`${path}: cycle`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== Array.prototype) {
    throw new Error(`${path}: non-plain object`);
  }
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === "length") continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (typeof key !== "string" || !descriptor.enumerable || !("value" in descriptor)) {
      throw new Error(`${path}: non-enumerable or accessor key`);
    }
    assertStrictJson(descriptor.value, `${path}.${key}`, seen);
  }
  seen.delete(value);
}

const docs: DocEntryLike[] = [
  { slug: "guides/intro", data: { title: "Intro", description: "First", sidebar_position: 1 } },
  { slug: "guides/advanced", data: { title: "Advanced", sidebar_position: 2 } },
];

describe("island nav props strict JSON", () => {
  it("accepts real sidebar, nav, and root-menu builders", () => {
    const sidebar = buildSidebarTree(docs, "en");
    const nav = buildNavTree(docs, "en", undefined, (slug) => `/docs/${slug}/`);
    const menu = buildRootMenuItems("en", undefined, [{ label: "Docs", path: "/docs" }],
      (key) => key, (path) => path);
    expect(() => assertStrictJson({ sidebar, nav, menu })).not.toThrow();
    expect(Object.hasOwn(nav[0]!.children[1]!, "description")).toBe(false);
  });

  it("rejects undefined and hidden keys that normal JSON serialization misses", () => {
    expect(() => assertStrictJson({ omitted: undefined })).toThrow(/invalid undefined/);
    const hidden = { label: "ok" };
    Object.defineProperty(hidden, "private", { value: 1, enumerable: false });
    expect(() => assertStrictJson(hidden)).toThrow(/non-enumerable/);
    expect(() => assertStrictJson({ date: new Date() })).toThrow(/non-plain/);
  });
});
