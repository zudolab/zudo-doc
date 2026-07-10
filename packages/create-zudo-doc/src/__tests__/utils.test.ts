import { describe, it, expect } from "vitest";
import { pmRunCommand } from "../utils.js";

describe("pmRunCommand — package.json script invocation per package manager", () => {
  it.each([
    ["pnpm", "build", "pnpm build"],
    ["yarn", "build", "yarn build"],
    ["npm", "build", "npm run build"],
    // The bug this helper fixes: `bun build` invokes Bun's BUNDLER, not the
    // package.json `build` script — bun must use the `run` verb.
    ["bun", "build", "bun run build"],
  ] as const)("%s → %s script emits %s", (pm, script, expected) => {
    expect(pmRunCommand(pm, script)).toBe(expected);
  });

  it("bun never emits a bare `bun <script>` (bundler footgun guard)", () => {
    for (const script of ["build", "dev", "check", "preview"]) {
      expect(pmRunCommand("bun", script)).toBe(`bun run ${script}`);
    }
  });
});
