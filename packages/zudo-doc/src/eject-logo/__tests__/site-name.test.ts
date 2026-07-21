import { describe, it, expect } from "vitest";
import { resolveSiteNameFromConfigSource } from "../site-name.js";

const CANONICAL_WITH_SITE_NAME = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    colorScheme: "Default Dark",
    siteName: "My Docs",
  }),
);
`;

const CANONICAL_NO_SITE_NAME = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    colorScheme: "Default Dark",
  }),
);
`;

const CANONICAL_COMPUTED_SITE_NAME = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
import { SITE_NAME } from "./site-name";

export default defineConfig(
  zudoDoc({
    siteName: SITE_NAME,
  }),
);
`;

const CANONICAL_DUPLICATE_SITE_NAME = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    siteName: "First",
    siteName: "Second",
  }),
);
`;

const NONCANONICAL_SPREAD = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
import { settings } from "./src/config/settings";

export default defineConfig(
  zudoDoc({
    ...settings,
  }),
);
`;

describe("resolveSiteNameFromConfigSource", () => {
  it("reads a literal siteName string", () => {
    expect(resolveSiteNameFromConfigSource(CANONICAL_WITH_SITE_NAME)).toEqual({
      kind: "literal",
      value: "My Docs",
    });
  });

  it("reports absent when the canonical config declares no siteName field", () => {
    expect(resolveSiteNameFromConfigSource(CANONICAL_NO_SITE_NAME)).toEqual({ kind: "absent" });
  });

  it("reports unresolvable for a computed (non-literal) siteName value", () => {
    const result = resolveSiteNameFromConfigSource(CANONICAL_COMPUTED_SITE_NAME);
    expect(result.kind).toBe("unresolvable");
    if (result.kind !== "unresolvable") return;
    expect(result.reason).toMatch(/not a plain string literal/);
  });

  it("reports unresolvable for a duplicate siteName field", () => {
    const result = resolveSiteNameFromConfigSource(CANONICAL_DUPLICATE_SITE_NAME);
    expect(result.kind).toBe("unresolvable");
    if (result.kind !== "unresolvable") return;
    expect(result.reason).toMatch(/more than once/);
  });

  it("reports unresolvable for a spread-argument config", () => {
    const result = resolveSiteNameFromConfigSource(NONCANONICAL_SPREAD);
    expect(result.kind).toBe("unresolvable");
    if (result.kind !== "unresolvable") return;
    expect(result.reason).toMatch(/spread argument/i);
  });

  it("reports unresolvable when no zudoDoc(...) call is found", () => {
    const result = resolveSiteNameFromConfigSource("export default {};\n");
    expect(result.kind).toBe("unresolvable");
    if (result.kind !== "unresolvable") return;
    expect(result.reason).toMatch(/no zudoDoc\(\.\.\.\) call found/);
  });
});
