// Drift guard for the two hand-duplicated resizer-handle geometry blocks
// (zudolab/zudo-doc#3117):
//
//   - packages/zudo-doc/src/sidebar-resizer/index.ts
//     (`initSidebarResizer()`, the exported module API)
//   - packages/zudo-doc/src/sidebar-resizer/sidebar-resizer-init.tsx
//     (`SIDEBAR_RESIZER_INIT_SCRIPT`, the inline body-end script string the
//     shipped layout actually runs)
//
// Both call `Object.assign(handle.style, { ... left, width, ... })` with the
// exact same `left`/`width` values, but one is real TypeScript and the other
// is a minified single-line script string embedded via `dangerouslySetInnerHTML`
// — their surrounding syntax can never be made textually identical the way
// e.g. doc-history-exclude/__tests__/parity.test.ts compares whole function
// bodies. So this guard extracts just the two geometry values from each file's
// `Object.assign(handle.style, …)` call and compares those.
//
// If this test fails: the two copies' handle geometry has drifted. Make the
// `left`/`width` values identical again in both
// sidebar-resizer/index.ts and sidebar-resizer/sidebar-resizer-init.tsx.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// src/sidebar-resizer/__tests__/ → src/sidebar-resizer/
const resizerDir = resolve(__dirname, "..");

const MODULE_API_FILE = resolve(resizerDir, "index.ts");
const INLINE_SCRIPT_FILE = resolve(resizerDir, "sidebar-resizer-init.tsx");

interface HandleGeometry {
  left: string;
  width: string;
}

/**
 * Extract the `left`/`width` values from the FIRST `Object.assign(handle.style,
 * { … })` call in a file. Scoped to `handle.style` (not `ghost.style`, which
 * also sets a `width` for the drag-ghost line) by slicing from that literal
 * substring up to the call's closing `)`.
 */
function extractHandleGeometry(file: string): HandleGeometry {
  const src = readFileSync(file, "utf-8");
  const start = src.indexOf("Object.assign(handle.style");
  if (start === -1) {
    throw new Error(`Could not locate 'Object.assign(handle.style' in ${file}`);
  }
  const end = src.indexOf(");", start);
  if (end === -1) {
    throw new Error(`Could not locate the closing ');' for the handle.style Object.assign in ${file}`);
  }
  const block = src.slice(start, end);

  // Narrow the captures themselves, not just the match arrays: under
  // noUncheckedIndexedAccess a non-null match still types `[1]` as
  // `string | undefined`, so checking the arrays alone fails to typecheck.
  const left = block.match(/left:\s*"([^"]+)"/)?.[1];
  const width = block.match(/width:\s*"([^"]+)"/)?.[1];
  if (left === undefined || width === undefined) {
    throw new Error(`Could not find both 'left' and 'width' in the handle.style Object.assign in ${file}`);
  }

  return { left, width };
}

describe("sidebar resizer handle geometry parity", () => {
  it("keeps left/width identical between the module API and the inline script", () => {
    const moduleGeometry = extractHandleGeometry(MODULE_API_FILE);
    const scriptGeometry = extractHandleGeometry(INLINE_SCRIPT_FILE);
    expect(scriptGeometry).toEqual(moduleGeometry);
  });

  it("matches the specced straddle geometry (#3117)", () => {
    // Pinned literal — not just cross-file equality — so a change that
    // updates both copies IDENTICALLY but drifts away from the specced
    // straddle geometry still fails loudly.
    const expected: HandleGeometry = {
      left: "calc(var(--zd-sidebar-w) - 4px)",
      width: "16px",
    };
    expect(extractHandleGeometry(MODULE_API_FILE)).toEqual(expected);
    expect(extractHandleGeometry(INLINE_SCRIPT_FILE)).toEqual(expected);
  });

  it("self-test: the extractor actually reads real geometry values, not an empty match", () => {
    // Guards against the comparisons above passing vacuously (e.g. both
    // sides silently reducing to the same falsy value after a refactor of
    // the extractor itself).
    const geometry = extractHandleGeometry(MODULE_API_FILE);
    expect(geometry.left.length).toBeGreaterThan(0);
    expect(geometry.width.length).toBeGreaterThan(0);
    expect(geometry.left).toContain("--zd-sidebar-w");
    expect(geometry.width).toMatch(/^\d+px$/);
  });
});
