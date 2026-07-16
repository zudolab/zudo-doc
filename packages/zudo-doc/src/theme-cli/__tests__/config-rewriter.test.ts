import { describe, it, expect } from "vitest";
import { applyThemePackToConfigSource } from "../config-rewriter.js";

// ── Fixture configs — the canonical `zudoDoc({ ... })` shape ─────────────────

const CANONICAL_WITH_COLOR_MODE = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    // Color scheme
    colorScheme: "Default Dark",
    colorMode: {
      defaultMode: "dark",
      lightScheme: "Default Light",
      darkScheme: "Default Dark",
      respectPrefersColorScheme: true,
    },
    siteName: "Docs",
    minifyHtml: true,
  }),
);
`;

const CANONICAL_WITH_COLOR_SCHEME_ONLY = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    colorScheme: "Default Dark",
    siteName: "Docs",
  }),
);
`;

const CANONICAL_NO_ANCHOR = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    siteName: "Docs",
    minifyHtml: true,
  }),
);
`;

const CANONICAL_ALREADY_APPLIED = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    colorScheme: "Default Dark",
    // hand-edited note that must survive a rewrite
    themePack: "default",
    siteName: "Docs",
  }),
);
`;

const NONCANONICAL_SPREAD = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
import { settings } from "./src/config/settings";

export default defineConfig(
  zudoDoc({
    ...settings,
    chromeBindingsModule: "./src/chrome-bindings.tsx",
  }),
);
`;

const NONCANONICAL_COMPUTED = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
import { buildConfig } from "./build-config";

export default defineConfig(zudoDoc(buildConfig()));
`;

const NONCANONICAL_MISSING_CALL = `import { defineConfig } from "zfb/config";

export default defineConfig({ siteName: "Docs" });
`;

const NONCANONICAL_MULTIPLE_CALLS = `import { zudoDoc } from "@takazudo/zudo-doc/config";

const a = zudoDoc({ siteName: "A" });
const b = zudoDoc({ siteName: "B" });
`;

const NONCANONICAL_MULTI_ARG = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
import { extra } from "./extra";

export default defineConfig(zudoDoc({ siteName: "Docs" }, extra));
`;

const CANONICAL_TRAILING_COMMA_IN_CALL = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc(
    {
      siteName: "Docs",
    },
  ),
);
`;

const NONCANONICAL_TEMPLATE_INTERPOLATION = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

const name = "Docs";

export default defineConfig(
  zudoDoc({
    siteName: \`Hello \${name}\`,
  }),
);
`;

// ── Canonical config — insertion ──────────────────────────────────────────────

describe("applyThemePackToConfigSource — canonical config, field absent (insert)", () => {
  it("inserts right after colorMode when both colorScheme and colorMode are present", () => {
    const result = applyThemePackToConfigSource(CANONICAL_WITH_COLOR_MODE, "foundry");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe("inserted-after-color-mode");
    expect(result.changed).toBe(true);
    expect(result.source).toContain('themePack: "foundry",');
    // Inserted right after colorMode's closing brace + comma, before siteName.
    const colorModeEnd = result.source.indexOf("respectPrefersColorScheme: true,");
    const themePackIdx = result.source.indexOf('themePack: "foundry"');
    const siteNameIdx = result.source.indexOf('siteName: "Docs"');
    expect(colorModeEnd).toBeGreaterThan(-1);
    expect(themePackIdx).toBeGreaterThan(colorModeEnd);
    expect(siteNameIdx).toBeGreaterThan(themePackIdx);
    // Everything else — including the leading comment — is untouched.
    expect(result.source).toContain("// Color scheme");
    expect(result.source).toContain('minifyHtml: true,');
  });

  it("inserts right after colorScheme when colorMode is absent", () => {
    const result = applyThemePackToConfigSource(CANONICAL_WITH_COLOR_SCHEME_ONLY, "foundry");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe("inserted-after-color-scheme");
    const colorSchemeIdx = result.source.indexOf('colorScheme: "Default Dark",');
    const themePackIdx = result.source.indexOf('themePack: "foundry"');
    const siteNameIdx = result.source.indexOf('siteName: "Docs"');
    expect(themePackIdx).toBeGreaterThan(colorSchemeIdx);
    expect(siteNameIdx).toBeGreaterThan(themePackIdx);
  });

  it("inserts as the first field when neither colorScheme nor colorMode is present", () => {
    const result = applyThemePackToConfigSource(CANONICAL_NO_ANCHOR, "foundry");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe("inserted-first");
    const themePackIdx = result.source.indexOf('themePack: "foundry"');
    const siteNameIdx = result.source.indexOf('siteName: "Docs"');
    expect(themePackIdx).toBeGreaterThan(-1);
    expect(siteNameIdx).toBeGreaterThan(themePackIdx);
  });

  it("produces syntactically balanced output (brace/paren counts unchanged in delta)", () => {
    const result = applyThemePackToConfigSource(CANONICAL_NO_ANCHOR, "foundry");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const opens = (result.source.match(/\{/g) ?? []).length;
    const closes = (result.source.match(/\}/g) ?? []).length;
    expect(opens).toBe(closes);
  });
});

// ── Canonical config — replace existing field ────────────────────────────────

describe("applyThemePackToConfigSource — canonical config, field present (replace)", () => {
  it("replaces the value only, never duplicating the field", () => {
    const result = applyThemePackToConfigSource(CANONICAL_ALREADY_APPLIED, "foundry");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe("replaced");
    expect(result.changed).toBe(true);
    const matches = result.source.match(/themePack\s*:/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(result.source).toContain('themePack: "foundry",');
    expect(result.source).not.toContain('themePack: "default"');
  });

  it("preserves a comment adjacent to the replaced field", () => {
    const result = applyThemePackToConfigSource(CANONICAL_ALREADY_APPLIED, "foundry");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toContain("// hand-edited note that must survive a rewrite");
  });

  it("apply default explicitly SETS themePack to \"default\" rather than removing the field", () => {
    const result = applyThemePackToConfigSource(CANONICAL_ALREADY_APPLIED, "default");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toContain('themePack: "default",');
    const matches = result.source.match(/themePack\s*:/g) ?? [];
    expect(matches).toHaveLength(1);
  });
});

// ── Idempotency ───────────────────────────────────────────────────────────────

describe("applyThemePackToConfigSource — idempotent re-apply", () => {
  it("re-applying the already-configured slug is a no-op (byte-identical, changed: false)", () => {
    const first = applyThemePackToConfigSource(CANONICAL_NO_ANCHOR, "foundry");
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = applyThemePackToConfigSource(first.source, "foundry");
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.changed).toBe(false);
    expect(second.source).toBe(first.source);
  });

  it("re-applying the same already-applied slug on a hand-written config is stable", () => {
    const result = applyThemePackToConfigSource(CANONICAL_ALREADY_APPLIED, "default");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(false);
    expect(result.source).toBe(CANONICAL_ALREADY_APPLIED);
  });

  it("applying twice in a row (insert then re-apply) converges to a stable fixed point", () => {
    const first = applyThemePackToConfigSource(CANONICAL_WITH_COLOR_MODE, "foundry");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = applyThemePackToConfigSource(first.source, "foundry");
    const third = applyThemePackToConfigSource(
      second.ok ? second.source : first.source,
      "foundry",
    );
    expect(second.ok && !second.changed).toBe(true);
    expect(third.ok && !third.changed).toBe(true);
  });
});

// ── Refusal contract — never corrupt ─────────────────────────────────────────

describe("applyThemePackToConfigSource — refusal contract", () => {
  it("refuses a spread-argument config (zudoDoc({ ...settings }))", () => {
    const result = applyThemePackToConfigSource(NONCANONICAL_SPREAD, "foundry");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/spread argument/i);
    expect(result.reason).toContain('themePack: "foundry"');
  });

  it("refuses a computed-config argument (zudoDoc(buildConfig()))", () => {
    const result = applyThemePackToConfigSource(NONCANONICAL_COMPUTED, "foundry");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/computed|not called with a plain object literal/i);
    expect(result.reason).toContain('themePack: "foundry"');
  });

  it("refuses when there is no zudoDoc(...) call at all", () => {
    const result = applyThemePackToConfigSource(NONCANONICAL_MISSING_CALL, "foundry");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/no zudoDoc\(\.\.\.\) call found/i);
  });

  it("refuses a config with duplicate themePack keys (JS uses the last; a first-match rewrite would mis-report)", () => {
    const dup = [
      "import { defineConfig } from '@takazudo/zfb/config';",
      "import { zudoDoc } from '@takazudo/zudo-doc/config';",
      "export default defineConfig(",
      "  zudoDoc({",
      '    themePack: "default",',
      '    siteName: "x",',
      '    themePack: "foundry",',
      "  }),",
      ");",
      "",
    ].join("\n");
    const result = applyThemePackToConfigSource(dup, "foundry");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/more than once|duplicate/i);
  });

  it("refuses when there are multiple zudoDoc(...) call sites", () => {
    const result = applyThemePackToConfigSource(NONCANONICAL_MULTIPLE_CALLS, "foundry");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/multiple|2 zudoDoc/i);
  });

  it("refuses a zudoDoc(...) call with more than one argument", () => {
    const result = applyThemePackToConfigSource(NONCANONICAL_MULTI_ARG, "foundry");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/more than one argument/i);
  });

  it("refuses cleanly (does not throw) on unsupported template literal interpolation", () => {
    expect(() =>
      applyThemePackToConfigSource(NONCANONICAL_TEMPLATE_INTERPOLATION, "foundry"),
    ).not.toThrow();
    const result = applyThemePackToConfigSource(NONCANONICAL_TEMPLATE_INTERPOLATION, "foundry");
    expect(result.ok).toBe(false);
  });

  it("a refusal result never carries a `source` field to accidentally write back", () => {
    const result = applyThemePackToConfigSource(NONCANONICAL_SPREAD, "foundry");
    expect(result.ok).toBe(false);
    expect("source" in result).toBe(false);
  });

  it("accepts an optional trailing comma before the closing paren (zudoDoc({ ... },))", () => {
    const result = applyThemePackToConfigSource(CANONICAL_TRAILING_COMMA_IN_CALL, "foundry");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toContain('themePack: "foundry",');
  });
});
