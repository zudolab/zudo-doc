import { describe, expect, it } from "vitest";

import {
  FALLBACK_SLUG,
  MAX_SLUG_BYTES,
  dedupeSlug,
  deriveSlug,
  deriveUniqueSlug,
  isValidSlug,
  slugByteLength,
  validateSlug,
} from "../slugs";

describe("deriveSlug", () => {
  it("kebab-cases plain titles", () => {
    expect(deriveSlug("Getting Started")).toBe("getting-started");
  });

  it("collapses runs of separators and trims the edges", () => {
    expect(deriveSlug("  Quick   Start!  ")).toBe("quick-start");
    expect(deriveSlug("--Hello--World--")).toBe("hello-world");
  });

  it("drops punctuation and symbols", () => {
    expect(deriveSlug("C++ & Rust")).toBe("c-rust");
    expect(deriveSlug("What's new?")).toBe("what-s-new");
    expect(deriveSlug("🎉 Party 🎉")).toBe("party");
  });

  it("keeps path characters out of the result", () => {
    expect(deriveSlug("docs/getting.started\\here")).toBe(
      "docs-getting-started-here",
    );
  });

  it("preserves non-ASCII scripts", () => {
    expect(deriveSlug("はじめに")).toBe("はじめに");
    expect(deriveSlug("設定 ガイド")).toBe("設定-ガイド");
  });

  it("normalizes decomposed input to NFC", () => {
    const decomposed = "Café";
    expect(deriveSlug(decomposed)).toBe("café");
  });

  it("falls back when a title contains nothing slug-worthy", () => {
    expect(deriveSlug("...")).toBe(FALLBACK_SLUG);
    expect(deriveSlug("")).toBe(FALLBACK_SLUG);
    expect(deriveSlug("   ")).toBe(FALLBACK_SLUG);
  });

  it("caps the result in bytes, not characters", () => {
    const derived = deriveSlug("あ".repeat(40));
    expect(slugByteLength(derived)).toBeLessThanOrEqual(MAX_SLUG_BYTES);
    // 3 bytes per character, so 21 fit and the 22nd would overflow.
    expect(Array.from(derived)).toHaveLength(21);
    expect(validateSlug(derived)).toBeNull();
  });

  it("truncates on a code-point boundary", () => {
    // Mathematical bold capitals: 4 UTF-8 bytes each, and no case mapping, so
    // a naive byte slice would leave a broken surrogate pair behind.
    const derived = deriveSlug("\u{1D400}".repeat(30));
    expect(slugByteLength(derived)).toBe(MAX_SLUG_BYTES);
    expect(Array.from(derived)).toHaveLength(16);
    expect(derived).not.toContain("�");
    expect(validateSlug(derived)).toBeNull();
  });

  it("never leaves a trailing hyphen after truncation", () => {
    const derived = deriveSlug(`${"a".repeat(63)} tail`);
    expect(derived.endsWith("-")).toBe(false);
    expect(validateSlug(derived)).toBeNull();
  });

  it("always produces a valid slug", () => {
    const titles = [
      "Getting Started",
      "C++ & Rust",
      "はじめに",
      "...",
      "Café",
      "MiXeD CaSe",
      "a".repeat(200),
    ];
    for (const title of titles) {
      expect(validateSlug(deriveSlug(title))).toBeNull();
    }
  });
});

describe("validateSlug", () => {
  it("accepts well-formed slugs", () => {
    for (const slug of ["getting-started", "v2", "a", "はじめに", "café"]) {
      expect(validateSlug(slug)).toBeNull();
      expect(isValidSlug(slug)).toBe(true);
    }
  });

  it("reports empty input", () => {
    expect(validateSlug("")).toBe("empty");
    expect(validateSlug(undefined)).toBe("empty");
    expect(validateSlug(null)).toBe("empty");
    expect(validateSlug(42)).toBe("empty");
  });

  it("reports decomposed input", () => {
    expect(validateSlug("café")).toBe("not-normalized");
  });

  it("reports uppercase", () => {
    expect(validateSlug("Intro")).toBe("not-lowercase");
    expect(validateSlug("INTRO")).toBe("not-lowercase");
  });

  it("reports path-like and otherwise unsafe characters", () => {
    const rejected = [
      "a/b",
      "a.b",
      "a\\b",
      "a b",
      "a_b",
      "a:b",
      "a?b",
      "a#b",
      "a%b",
      "-lead",
      "trail-",
      "double--hyphen",
      "-",
      "a\u0000b",
      "a\u007Fb",
    ];
    for (const slug of rejected) {
      expect(validateSlug(slug), slug).toBe("invalid-characters");
      expect(isValidSlug(slug)).toBe(false);
    }
  });

  it("reports slugs past the byte cap", () => {
    expect(validateSlug("a".repeat(MAX_SLUG_BYTES))).toBeNull();
    expect(validateSlug("a".repeat(MAX_SLUG_BYTES + 1))).toBe("too-long");
    // 22 three-byte characters is 66 bytes but only 22 code points.
    expect(validateSlug("あ".repeat(22))).toBe("too-long");
  });
});

describe("dedupeSlug", () => {
  it("returns the base when it is free", () => {
    expect(dedupeSlug("guides", [])).toBe("guides");
    expect(dedupeSlug("guides", ["other"])).toBe("guides");
  });

  it("appends the first free numeric suffix", () => {
    expect(dedupeSlug("guides", ["guides"])).toBe("guides-2");
    expect(dedupeSlug("guides", ["guides", "guides-2"])).toBe("guides-3");
    expect(dedupeSlug("guides", ["guides", "guides-2", "guides-3"])).toBe(
      "guides-4",
    );
  });

  it("skips over gaps rather than reusing a taken suffix", () => {
    expect(dedupeSlug("guides", ["guides", "guides-3"])).toBe("guides-2");
  });

  it("keeps the suffixed slug inside the byte cap", () => {
    const base = "a".repeat(MAX_SLUG_BYTES);
    const deduped = dedupeSlug(base, [base]);
    expect(slugByteLength(deduped)).toBeLessThanOrEqual(MAX_SLUG_BYTES);
    expect(deduped.endsWith("-2")).toBe(true);
    expect(validateSlug(deduped)).toBeNull();
  });

  it("keeps multi-digit suffixes inside the byte cap", () => {
    const base = "a".repeat(MAX_SLUG_BYTES);
    const taken = [base, ...range(2, 11).map((n) => `${"a".repeat(62)}-${n}`)];
    const deduped = dedupeSlug(base, taken);
    expect(slugByteLength(deduped)).toBeLessThanOrEqual(MAX_SLUG_BYTES);
    expect(validateSlug(deduped)).toBeNull();
  });
});

describe("deriveUniqueSlug", () => {
  it("derives then dedupes in one step", () => {
    expect(deriveUniqueSlug("Getting Started", ["getting-started"])).toBe(
      "getting-started-2",
    );
  });
});

function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let value = start; value < end; value += 1) out.push(value);
  return out;
}
