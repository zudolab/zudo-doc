/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { NoteTrayIndex } from "../note-tray-index.js";
import { serialize } from "./helpers.js";
import { base, item } from "./note-tray-test-helpers.js";

describe("NoteTrayIndex card style", () => {
  it("renders cards with h2 links, excerpts, tags, and showDate-gated dates", () => {
    const tagged = item("card", {
      date: "2026-08-22",
      tagLinks: [{ tag: "preact", href: "/docs/tags/preact" }],
    });
    const shown = serialize(NoteTrayIndex({ ...base, style: "cards", showDate: true, items: [tagged] }));
    const hidden = serialize(NoteTrayIndex({ ...base, style: "cards", items: [tagged] }));
    expect(shown).toContain("<h2");
    expect(shown).toContain("About card");
    expect(shown).toContain("#preact");
    expect(shown).toContain("Aug 22, 2026");
    expect(hidden).not.toContain("Aug 22, 2026");
  });
});
