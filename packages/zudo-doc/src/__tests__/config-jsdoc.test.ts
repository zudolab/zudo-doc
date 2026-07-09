import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

// ── HARD GATE (#2657, acceptance 4) ──────────────────────────────────────────
// `ZudoDocConfig` IS the user-facing settings reference — the IDE-hover
// documentation the docs pages align with. Every field MUST carry a JSDoc block
// that records its `@default`. This test parses `src/config.ts` and fails if any
// `ZudoDocConfig` field is missing a preceding `@default` annotation.
// ─────────────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const configSrc = readFileSync(resolve(__dirname, "../config.ts"), "utf8");

function extractZudoDocConfigBody(src: string): string {
  // Everything between `export interface ZudoDocConfig {` and the first
  // column-0 closing `}` (the interface has no nested column-0 braces).
  const m = src.match(/export interface ZudoDocConfig \{([\s\S]*?)\n\}/);
  if (!m) throw new Error("Could not locate `export interface ZudoDocConfig {`");
  return m[1]!;
}

describe("ZudoDocConfig field JSDoc @default coverage", () => {
  it("every field carries a preceding JSDoc block containing @default", () => {
    const body = extractZudoDocConfigBody(configSrc);
    const lines = body.split("\n");

    // Top-level field declarations only: two-space indent, `name?:` / `name:`.
    const fieldRe = /^ {2}(\w+)\??\s*:/;

    const fields: string[] = [];
    const missing: string[] = [];
    let commentBuffer = "";

    for (const line of lines) {
      const fieldMatch = line.match(fieldRe);
      if (fieldMatch) {
        const name = fieldMatch[1]!;
        fields.push(name);
        if (!/@default/.test(commentBuffer)) {
          missing.push(name);
        }
        commentBuffer = "";
        continue;
      }
      // Accumulate comment/section-separator text since the last field.
      commentBuffer += line + "\n";
    }

    expect(fields.length).toBeGreaterThan(40);
    expect(missing, `fields missing an @default JSDoc: ${missing.join(", ")}`).toEqual([]);
  });
});
