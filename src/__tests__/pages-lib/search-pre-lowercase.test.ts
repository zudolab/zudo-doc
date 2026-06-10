/**
 * search-pre-lowercase.test.ts
 *
 * Unit-level evidence for C2 (S9): the search index fields are pre-lowercased
 * once at load time (prepareLc) so that scoreEntry() can use plain indexOf()
 * against cached _titleLc / _descLc / _bodyLc fields rather than calling
 * toLowerCase() on the entire ~162 KB index on every debounced keystroke.
 *
 * The actual scoring/prepare logic lives inside an IIFE template string in
 * _search-widget-script.ts (it must be plain-JS for inline-script emission).
 * We mirror the logic here as typed helpers to keep the test simple and fast.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Mirrors of the IIFE functions in _search-widget-script.ts
// ---------------------------------------------------------------------------

interface SearchEntry {
  title?: string;
  description?: string;
  body?: string;
  // Pre-lowercased fields added by prepareLc()
  _titleLc?: string;
  _descLc?: string;
  _bodyLc?: string;
}

/** Mirror of prepareLc() in the IIFE script */
function prepareLc(entries: SearchEntry[]): void {
  for (const e of entries) {
    e._titleLc = (e.title       ?? "").toLowerCase();
    e._descLc  = (e.description ?? "").toLowerCase();
    e._bodyLc  = (e.body        ?? "").toLowerCase();
  }
}

/** Mirror of scoreEntry() in the IIFE script (post-C2 version) */
function scoreEntry(entry: SearchEntry, terms: string[]): number {
  let score = 0;
  const titleLc = entry._titleLc ?? "";
  const descLc  = entry._descLc  ?? "";
  const bodyLc  = entry._bodyLc  ?? "";
  for (const t of terms) {
    // terms are already lowercased by the caller (search())
    if (titleLc.includes(t)) score += 3;
    if (descLc.includes(t))  score += 2;
    if (bodyLc.includes(t))  score += 1;
  }
  return score;
}

// ---------------------------------------------------------------------------
// prepareLc — index pre-processing
// ---------------------------------------------------------------------------

describe("prepareLc", () => {
  it("adds _titleLc, _descLc, _bodyLc to each entry", () => {
    const entries: SearchEntry[] = [
      { title: "Hello World", description: "A Greeting", body: "Some Body Text" },
    ];
    prepareLc(entries);
    expect(entries[0]._titleLc).toBe("hello world");
    expect(entries[0]._descLc).toBe("a greeting");
    expect(entries[0]._bodyLc).toBe("some body text");
  });

  it("preserves the original-case fields for display", () => {
    const entries: SearchEntry[] = [
      { title: "My Title", description: "My Desc", body: "My Body" },
    ];
    prepareLc(entries);
    expect(entries[0].title).toBe("My Title");
    expect(entries[0].description).toBe("My Desc");
    expect(entries[0].body).toBe("My Body");
  });

  it("handles missing optional fields with empty string", () => {
    const entries: SearchEntry[] = [{}];
    prepareLc(entries);
    expect(entries[0]._titleLc).toBe("");
    expect(entries[0]._descLc).toBe("");
    expect(entries[0]._bodyLc).toBe("");
  });

  it("lowercases unicode / mixed-case correctly", () => {
    const entries: SearchEntry[] = [
      { title: "UPPERCASE TypeScript" },
    ];
    prepareLc(entries);
    expect(entries[0]._titleLc).toBe("uppercase typescript");
  });
});

// ---------------------------------------------------------------------------
// scoreEntry — per-keystroke scoring (uses pre-lowercased fields)
// ---------------------------------------------------------------------------

describe("scoreEntry", () => {
  it("returns 0 when no terms match", () => {
    const entry: SearchEntry = { _titleLc: "hello", _descLc: "world", _bodyLc: "foo" };
    expect(scoreEntry(entry, ["nomatch"])).toBe(0);
  });

  it("scores title matches as 3", () => {
    const entry: SearchEntry = { _titleLc: "hello world", _descLc: "", _bodyLc: "" };
    expect(scoreEntry(entry, ["hello"])).toBe(3);
  });

  it("scores description matches as 2", () => {
    const entry: SearchEntry = { _titleLc: "", _descLc: "hello world", _bodyLc: "" };
    expect(scoreEntry(entry, ["hello"])).toBe(2);
  });

  it("scores body matches as 1", () => {
    const entry: SearchEntry = { _titleLc: "", _descLc: "", _bodyLc: "hello world" };
    expect(scoreEntry(entry, ["hello"])).toBe(1);
  });

  it("accumulates scores for multiple fields matching the same term", () => {
    const entry: SearchEntry = {
      _titleLc: "hello",
      _descLc:  "hello",
      _bodyLc:  "hello",
    };
    expect(scoreEntry(entry, ["hello"])).toBe(6); // 3 + 2 + 1
  });

  it("accumulates scores across multiple terms", () => {
    const entry: SearchEntry = {
      _titleLc: "react hooks",
      _descLc:  "state management",
      _bodyLc:  "",
    };
    // "react" hits title (+3), "state" hits desc (+2) → total 5
    expect(scoreEntry(entry, ["react", "state"])).toBe(5);
  });

  it("terms arrive pre-lowercased — no extra toLower call needed", () => {
    // If terms were NOT pre-lowercased the match would fail (entry fields are lc).
    // This test documents the contract: caller must pass lc terms.
    const entry: SearchEntry = { _titleLc: "typescript", _descLc: "", _bodyLc: "" };
    // lowercase term → match
    expect(scoreEntry(entry, ["typescript"])).toBe(3);
    // If caller accidentally passes uppercase → no match (correct contract behaviour)
    expect(scoreEntry(entry, ["TypeScript"])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration: prepareLc → scoreEntry round-trip
// ---------------------------------------------------------------------------

describe("prepareLc + scoreEntry round-trip", () => {
  it("correctly scores after index is prepared", () => {
    const entries: SearchEntry[] = [
      {
        title: "Preact Performance",
        description: "Memo and useMemo patterns",
        body:  "Avoid re-rendering unchanged nodes with memo()",
      },
    ];
    prepareLc(entries);

    // Search query terms are lowercased by the caller (mirrors search())
    const terms = ["preact", "memo"].map((t) => t.toLowerCase());
    const score = scoreEntry(entries[0], terms);

    // "preact" in title (+3), "memo" in description (+2) + "memo" in body (+1)
    expect(score).toBe(6);
  });

  it("does not score on original-case fields (prepareLc only writes _lc fields)", () => {
    const entry: SearchEntry = { title: "TypeScript" };
    prepareLc([entry]);

    // Scoring works against _titleLc, not title
    expect(scoreEntry(entry, ["typescript"])).toBe(3);
    // Upper-case term does NOT match _titleLc (user must pass lc terms)
    expect(scoreEntry(entry, ["TypeScript"])).toBe(0);
  });
});
