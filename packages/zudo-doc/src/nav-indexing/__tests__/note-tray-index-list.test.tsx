/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { NoteTrayIndex } from "../note-tray-index.js";
import { serialize } from "./helpers.js";
import { base, item } from "./note-tray-test-helpers.js";

describe("NoteTrayIndex index style", () => {
  it("renders zero-padded index rows, descriptions, and optional date/updated", () => {
    const html = serialize(
      NoteTrayIndex({
        ...base,
        showDate: true,
        items: [item("one", { rank: 1, date: "2026-08-22", updated: "2026-08-23" })],
      }),
    );
    expect(html).toContain(">01</span>");
    expect(html).toContain('href="/docs/one"');
    expect(html).toContain("About one");
    expect(html).toContain("Aug 22, 2026");
    expect(html).toContain("Updated <time");
  });

  it("keeps the visible stable rank accessible and never invents rank 00", () => {
    const ranked = serialize(
      NoteTrayIndex({ ...base, items: [item("sixth", { rank: 6 })] }),
    );
    const missing = serialize(
      NoteTrayIndex({ ...base, items: [item("missing", { rank: undefined })] }),
    );

    const rankSpan = ranked.match(/<span[^>]*>06<\/span>/)?.[0];
    expect(rankSpan).toBeDefined();
    expect(rankSpan).not.toContain("aria-hidden");
    expect(missing).not.toContain(">00</span>");
    expect(missing).toMatch(/<span[^>]*text-heading[^>]*><\/span>/);
  });
});
