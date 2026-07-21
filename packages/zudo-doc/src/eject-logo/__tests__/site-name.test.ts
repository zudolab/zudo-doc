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

describe("resolveSiteNameFromConfigSource — string escapes (#3054)", () => {
  const withSiteName = (literal: string) =>
    `import { zudoDoc } from "@takazudo/zudo-doc/config";

export default zudoDoc({
  siteName: ${literal},
});
`;

  const expectName = (literal: string, expected: string) => {
    const result = resolveSiteNameFromConfigSource(withSiteName(literal));
    expect(result.kind).toBe("literal");
    if (result.kind !== "literal") return;
    expect(result.value).toBe(expected);
  };

  // JS evaluates these to the same string, so the derived logo seed — and
  // therefore the glyph an ejected SVG shows — must match `logo: "auto"`.
  it("decodes \\uXXXX escapes", () => {
    expectName('"A\\u0042"', "AB");
  });

  it("decodes \\u{...} code-point escapes", () => {
    expectName('"A\\u{42}"', "AB");
  });

  it("decodes surrogate pairs written as two \\uXXXX escapes", () => {
    expectName('"\\uD83D\\uDE00"', "\u{1f600}");
  });

  it("decodes \\xXX escapes", () => {
    expectName('"A\\x42"', "AB");
  });

  it("decodes the remaining single-character escapes", () => {
    expectName('"a\\bb"', "a\bb");
    expectName('"a\\fb"', "a\fb");
    expectName('"a\\vb"', "a\vb");
    expectName('"a\\0b"', "a\0b");
  });

  it("leaves a malformed escape as its literal character", () => {
    expectName('"A\\uZZZZ"', "AuZZZZ");
    expectName('"A\\xZZ"', "AxZZ");
  });

  it("still decodes the escapes it already handled", () => {
    expectName('"a\\nb"', "a\nb");
    expectName('"a\\tb"', "a\tb");
    expectName('"a\\rb"', "a\rb");
    expectName('"a\\"b"', 'a"b');
    expectName('"a\\\\b"', "a\\b");
  });
});
