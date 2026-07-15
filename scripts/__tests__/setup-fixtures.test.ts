import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const SETUP_FIXTURES = resolve(REPO_ROOT, "e2e", "setup-fixtures.sh");

describe("e2e fixture setup", () => {
  it("removes a stale copied root directory before a missing source short-circuits", () => {
    const script = readFileSync(SETUP_FIXTURES, "utf8");
    const copyLoopStart = script.indexOf("# ----- Copy top-level first-party dirs");
    const copyLoopEnd = script.indexOf("# The theme fixture", copyLoopStart);
    const copyLoop = script.slice(copyLoopStart, copyLoopEnd);
    const cleanupIndex = copyLoop.indexOf('rm -rf "$fixture_dir/$dir"');
    const sourceCheckIndex = copyLoop.indexOf('[ -e "$REPO_ROOT/$dir" ] || continue');

    expect(copyLoopStart).toBeGreaterThanOrEqual(0);
    expect(copyLoopEnd).toBeGreaterThan(copyLoopStart);
    expect(cleanupIndex).toBeGreaterThanOrEqual(0);
    expect(sourceCheckIndex).toBeGreaterThanOrEqual(0);
    expect(cleanupIndex).toBeLessThan(sourceCheckIndex);
  });
});
