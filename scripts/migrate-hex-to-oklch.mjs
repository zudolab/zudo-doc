#!/usr/bin/env node
/**
 * migrate-hex-to-oklch.mjs
 *
 * Converts quoted 6-digit hex color literals in TypeScript/JavaScript source
 * files to oklch() notation, with the original hex preserved in an inline
 * block comment for traceability.
 *
 * Usage:
 *   node scripts/migrate-hex-to-oklch.mjs <file1> [file2] ...
 *
 * Replacement format:
 *   "#rrggbb"  →  "oklch(L C H)" /* #rrggbb *\/
 *
 * The comment uses a block style (not //) so it doesn't accidentally comment
 * out subsequent tokens on a multi-value line (e.g. inside array literals).
 *
 * Round-trip guarantee: each oklch string is verified to round-trip exactly
 * back to the original hex via culori.formatHex(culori.parse(oklchStr)).
 * Minimum decimal precision is found per-value; the script fails loudly if
 * any value cannot round-trip at any reasonable precision.
 */

import { readFileSync, writeFileSync } from 'fs';
import { formatHex, parse, converter } from 'culori';

const toOklch = converter('oklch');

/**
 * Convert a single hex string to an oklch() string with minimum precision
 * that guarantees exact round-trip back to the original hex.
 *
 * @param {string} hex - e.g. "#a01515" (lowercase or uppercase, with #)
 * @returns {string} - e.g. "oklch(0.453 0.172 27.68)"
 * @throws if no precision within reasonable bounds achieves round-trip
 */
function hexToOklchString(hex) {
  const c = toOklch(hex);
  const l = c.l;
  const ch = c.c;
  // Hue is undefined for achromatic colors (c ≈ 0); use 0 — won't affect output.
  const h = c.h ?? 0;
  const hexLower = hex.toLowerCase();

  // Search from minimum precision upward.
  // Observed worst case across all project colors: L:3, C:6, H:3.
  // Upper bound 10 is a safety net.
  for (let lDec = 3; lDec <= 10; lDec++) {
    for (let cDec = 3; cDec <= 10; cDec++) {
      for (let hDec = 2; hDec <= 10; hDec++) {
        const str = `oklch(${l.toFixed(lDec)} ${ch.toFixed(cDec)} ${h.toFixed(hDec)})`;
        const roundTripped = formatHex(parse(str));
        if (roundTripped === hexLower) {
          return str;
        }
      }
    }
  }

  throw new Error(
    `Cannot round-trip ${hex} to oklch at any precision up to 10 decimals. ` +
    `OKLCH values: l=${l}, c=${ch}, h=${h}`
  );
}

/**
 * Process file content: replace all quoted 6-digit hex literals with oklch.
 *
 * Matches ONLY `"#rrggbb"` (inside double quotes) — this skips:
 *   - Bare integers (palette indices like `background: 9`)
 *   - GitHub issue refs in comments (#2298, #2333, etc. — not inside "")
 *   - 3-digit or 8-digit hex variants
 *
 * @param {string} content - file source text
 * @returns {{ content: string, count: number, failures: string[] }}
 */
function processContent(content) {
  let count = 0;
  const failures = [];

  const result = content.replace(/"(#[0-9a-fA-F]{6})"/g, (match, originalHex) => {
    try {
      const oklchStr = hexToOklchString(originalHex);
      count++;
      // Keep the original hex (preserving its original casing) in an inline
      // block comment. Block comment style avoids commenting out trailing
      // tokens on lines like:  "#ff0000", "#00ff00",
      return `"${oklchStr}" /* ${originalHex} */`;
    } catch (err) {
      failures.push(originalHex + ': ' + err.message);
      // Return original — failure is reported at end
      return match;
    }
  });

  return { content: result, count, failures };
}

// --- main ---

const filePaths = process.argv.slice(2);
if (filePaths.length === 0) {
  console.error('Usage: node scripts/migrate-hex-to-oklch.mjs <file1> [file2] ...');
  process.exit(1);
}

let totalConverted = 0;
const allFailures = [];

for (const filePath of filePaths) {
  const original = readFileSync(filePath, 'utf8');
  const { content, count, failures } = processContent(original);

  if (failures.length > 0) {
    for (const f of failures) {
      allFailures.push(`  ${filePath}: ${f}`);
    }
    console.error(`[FAIL] ${filePath}: ${failures.length} conversion failure(s)`);
  } else {
    writeFileSync(filePath, content, 'utf8');
    totalConverted += count;
    console.log(`[OK]   ${filePath}: ${count} hex value(s) converted`);
  }
}

console.log(`\nSummary: ${totalConverted} converted, ${allFailures.length} failures`);

if (allFailures.length > 0) {
  console.error('\nFailures:');
  for (const f of allFailures) {
    console.error(f);
  }
  process.exit(1);
}
