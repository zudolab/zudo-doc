import { describe, it, expect } from "vitest";
import { applyLogoFieldToConfigSource } from "../config-rewriter.js";

// ── Fixture configs — the canonical `zudoDoc({ ... })` shape ─────────────────

const CANONICAL_NO_LOGO = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    colorScheme: "Default Dark",
    siteName: "Docs",
  }),
);
`;

const CANONICAL_NO_SITE_NAME_ANCHOR = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    colorScheme: "Default Dark",
    minifyHtml: true,
  }),
);
`;

const CANONICAL_LOGO_STRING = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    siteName: "Docs",
    logo: "auto",
  }),
);
`;

const CANONICAL_LOGO_FALSE = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    siteName: "Docs",
    logo: false,
  }),
);
`;

const CANONICAL_LOGO_ALREADY_EJECTED = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    siteName: "Docs",
    logo: "/img/logo.svg",
  }),
);
`;

const CANONICAL_LOGO_COMPUTED = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
import { resolveLogo } from "./resolve-logo";

export default defineConfig(
  zudoDoc({
    siteName: "Docs",
    logo: resolveLogo(),
  }),
);
`;

const CANONICAL_LOGO_DUPLICATE = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    siteName: "Docs",
    logo: "/a.svg",
    logo: "/b.svg",
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

const NONCANONICAL_COMPUTED_ARG = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
import { buildConfig } from "./build-config";

export default defineConfig(zudoDoc(buildConfig()));
`;

describe("applyLogoFieldToConfigSource — insertion", () => {
  it("inserts logo right after siteName when siteName is present", () => {
    const result = applyLogoFieldToConfigSource(CANONICAL_NO_LOGO);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(true);
    expect(result.mode).toBe("inserted-after-site-name");
    expect(result.source).toContain('siteName: "Docs",\n    logo: "/img/logo.svg",');
  });

  it("inserts logo first when no siteName field exists to anchor on", () => {
    const result = applyLogoFieldToConfigSource(CANONICAL_NO_SITE_NAME_ANCHOR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(true);
    expect(result.mode).toBe("inserted-first");
    expect(result.source).toContain('logo: "/img/logo.svg",\n    colorScheme: "Default Dark",');
  });
});

describe("applyLogoFieldToConfigSource — replacement", () => {
  it("replaces an existing plain-string logo value", () => {
    const result = applyLogoFieldToConfigSource(CANONICAL_LOGO_STRING);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(true);
    expect(result.mode).toBe("replaced");
    expect(result.source).toContain('logo: "/img/logo.svg",');
    expect(result.source).not.toContain('logo: "auto"');
  });

  it("replaces logo: false — an explicit eject invocation is consent to override it", () => {
    const result = applyLogoFieldToConfigSource(CANONICAL_LOGO_FALSE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(true);
    expect(result.mode).toBe("replaced");
    expect(result.source).toContain('logo: "/img/logo.svg",');
    expect(result.source).not.toContain("logo: false");
  });

  it("is idempotent — re-applying to an already-ejected logo field is a no-op", () => {
    const result = applyLogoFieldToConfigSource(CANONICAL_LOGO_ALREADY_EJECTED);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(false);
    expect(result.mode).toBe("replaced");
    expect(result.source).toBe(CANONICAL_LOGO_ALREADY_EJECTED);
  });
});

describe("applyLogoFieldToConfigSource — refusals (never corrupt)", () => {
  it("refuses a computed logo value and leaves the file byte-identical", () => {
    const result = applyLogoFieldToConfigSource(CANONICAL_LOGO_COMPUTED);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/not a plain string literal or `false`/);
    expect(result.reason).toContain('logo: "/img/logo.svg",');
  });

  it("refuses a duplicate logo member", () => {
    const result = applyLogoFieldToConfigSource(CANONICAL_LOGO_DUPLICATE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/more than once/);
  });

  it("refuses a spread-argument config and leaves the file byte-identical", () => {
    const result = applyLogoFieldToConfigSource(NONCANONICAL_SPREAD);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/spread argument/i);
  });

  it("refuses a computed zudoDoc(...) argument", () => {
    const result = applyLogoFieldToConfigSource(NONCANONICAL_COMPUTED_ARG);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/computed or non-literal/);
  });

  it("refuses a config with no zudoDoc(...) call", () => {
    const result = applyLogoFieldToConfigSource("export default {};\n");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/no zudoDoc\(\.\.\.\) call found/);
  });
});

describe("applyLogoFieldToConfigSource — escaped keys (#3054)", () => {
  // JS reads `"lo\u0067o"` as the key `logo`. Before the scanner decoded
  // escapes, that member was invisible: the rewriter saw no logo field, INSERTED
  // one, and reported success — leaving a config with two logo members whose
  // effective value was not the one it just wrote.
  const ESCAPED_KEY = `import { zudoDoc } from "@takazudo/zudo-doc/config";

export default zudoDoc({
  siteName: "Docs",
  "lo\\u0067o": "/img/other.svg",
});
`;

  it("replaces an escaped logo key instead of inserting a second member", () => {
    const result = applyLogoFieldToConfigSource(ESCAPED_KEY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toContain("/img/logo.svg");
    expect(result.source).not.toContain("/img/other.svg");
    // The load-bearing assertion: exactly one logo member survives.
    expect(result.source.match(/lo(?:\\u0067|g)o"?\s*:/g)).toHaveLength(1);
  });

  // Two logo members, one written with an escape — a genuine duplicate that
  // must be refused rather than guessed at.
  const ESCAPED_DUPLICATE = `import { zudoDoc } from "@takazudo/zudo-doc/config";

export default zudoDoc({
  logo: "/img/a.svg",
  "lo\\u0067o": "/img/b.svg",
});
`;

  it("refuses when an escaped key duplicates a plain logo member", () => {
    const result = applyLogoFieldToConfigSource(ESCAPED_DUPLICATE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/more than once/);
  });
});
