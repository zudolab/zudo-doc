import { describe, expect, it } from "vitest";
import {
  assertValidHomeImage,
  isRootAbsoluteSitePath,
  assertAgentDocsConsistent,
  assertValidHeaderBrand,
  assertValidSearchMaxBodyLength,
  warnAmbiguousDropdownCategoryMatch,
} from "../index.js";

describe("assertAgentDocsConsistent", () => {
  it("accepts omitted and boolean fields when MCP's dependency is satisfied", () => {
    expect(() => assertAgentDocsConsistent({})).not.toThrow();
    expect(() => assertAgentDocsConsistent({ agentExport: false, mcp: false })).not.toThrow();
    expect(() => assertAgentDocsConsistent({ agentExport: true, mcp: false })).not.toThrow();
    expect(() => assertAgentDocsConsistent({ agentExport: true, mcp: true })).not.toThrow();
  });

  it("rejects unsupported runtime values with the locked type-guard messages", () => {
    expect(() => assertAgentDocsConsistent({ agentExport: "yes" })).toThrow(
      "agentExport must be a boolean.",
    );
    expect(() => assertAgentDocsConsistent({ mcp: 1 })).toThrow("mcp must be a boolean.");
  });

  it("rejects MCP unless agent export is explicitly enabled", () => {
    expect(() => assertAgentDocsConsistent({ mcp: true })).toThrow(
      "MCP requires agentExport: true. Remove the explicit agent export disable or disable MCP.",
    );
    expect(() => assertAgentDocsConsistent({ agentExport: false, mcp: true })).toThrow(
      "MCP requires agentExport: true. Remove the explicit agent export disable or disable MCP.",
    );
  });
});

function warningCollector(): { warnings: string[]; logger: { warn(message: string): void } } {
  const warnings: string[] = [];
  return { warnings, logger: { warn: (message: string) => warnings.push(message) } };
}

describe("warnAmbiguousDropdownCategoryMatch", () => {
  it("warns once for duplicate child categoryMatch values", () => {
    const { warnings, logger } = warningCollector();

    warnAmbiguousDropdownCategoryMatch(
      [
        {
          label: "Changelog",
          categoryMatch: "changelog",
          children: [
            { label: "Package A", categoryMatch: "changelog" },
            { label: "Package B", categoryMatch: "changelog" },
          ],
        },
      ],
      logger,
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"Changelog"');
    expect(warnings[0]).toContain('"changelog"');
    expect(warnings[0]).toContain("omit categoryMatch");
  });

  it("warns once for a slash-containing value even when parent and child repeat it", () => {
    const { warnings, logger } = warningCollector();

    warnAmbiguousDropdownCategoryMatch(
      [
        {
          label: "Learn",
          categoryMatch: "guides/components",
          children: [{ label: "Components", categoryMatch: "guides/components" }],
        },
      ],
      logger,
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"Learn"');
    expect(warnings[0]).toContain('"guides/components"');
    expect(warnings[0]).toContain("contains `/`");
  });

  it("does not warn for the showcase Learn shape or omitted nested matchers", () => {
    const { warnings, logger } = warningCollector();

    warnAmbiguousDropdownCategoryMatch(
      [
        {
          label: "Learn",
          categoryMatch: "guides",
          children: [
            { label: "Guides", categoryMatch: "guides" },
            { label: "Components", categoryMatch: "components" },
            { label: "Markdown Features", categoryMatch: "markdown-features" },
          ],
        },
        {
          label: "Changelog",
          categoryMatch: "changelog",
          children: [{ label: "Package A" }, { label: "Package B" }],
        },
        {
          label: "Default",
          categoryMatch: "!",
          children: [{ label: "A", categoryMatch: "!" }, { label: "B", categoryMatch: "!" }],
        },
      ],
      logger,
    );

    expect(warnings).toEqual([]);
  });
});

describe("assertValidSearchMaxBodyLength", () => {
  it("no-ops for undefined (the field is optional)", () => {
    expect(() => assertValidSearchMaxBodyLength(undefined)).not.toThrow();
  });

  it("accepts a positive integer", () => {
    expect(() => assertValidSearchMaxBodyLength(3000)).not.toThrow();
    expect(() => assertValidSearchMaxBodyLength(1)).not.toThrow();
  });

  it.each([0, -1, -3000])("throws for %s (not positive)", (value) => {
    expect(() => assertValidSearchMaxBodyLength(value)).toThrow(/searchMaxBodyLength/);
  });

  it.each([3.5, 0.1, -2.5])("throws for %s (not an integer)", (value) => {
    expect(() => assertValidSearchMaxBodyLength(value)).toThrow(/searchMaxBodyLength/);
  });
});

describe("assertValidHeaderBrand", () => {
  it("accepts omitted, false, and an object with a non-empty icon", () => {
    expect(() => assertValidHeaderBrand({})).not.toThrow();
    expect(() => assertValidHeaderBrand({ headerBrand: undefined })).not.toThrow();
    expect(() => assertValidHeaderBrand({ headerBrand: false })).not.toThrow();
    expect(() => assertValidHeaderBrand({ headerBrand: { icon: "/img/icon.svg" } })).not.toThrow();
    expect(() =>
      assertValidHeaderBrand({ headerBrand: { icon: "https://cdn.example.com/icon.svg" } }),
    ).not.toThrow();
    expect(() =>
      assertValidHeaderBrand({ headerBrand: { icon: "data:image/svg+xml,%3Csvg/%3E" } }),
    ).not.toThrow();
  });

  it.each([
    ["true", true],
    ["a string", "/img/icon.svg"],
    ["a number", 1],
    ["null", null],
    ["an array", [{ icon: "/img/icon.svg" }]],
  ])("rejects %s as the whole value, naming headerBrand", (_label, value) => {
    expect(() => assertValidHeaderBrand({ headerBrand: value })).toThrow(TypeError);
    expect(() => assertValidHeaderBrand({ headerBrand: value })).toThrow(/^Invalid headerBrand /);
  });

  it.each([
    ["a missing icon", {}],
    ["a non-string icon", { icon: 42 }],
    ["an empty icon", { icon: "" }],
  ])("rejects %s, naming headerBrand.icon", (_label, value) => {
    expect(() => assertValidHeaderBrand({ headerBrand: value })).toThrow(TypeError);
    expect(() => assertValidHeaderBrand({ headerBrand: value })).toThrow(/headerBrand\.icon/);
  });
});

describe("assertValidHomeImage", () => {
  it("accepts an absent home or image", () => {
    expect(() => assertValidHomeImage({})).not.toThrow();
    expect(() => assertValidHomeImage({ home: { wide: true } })).not.toThrow();
  });

  it("accepts a complete valid image", () => {
    expect(() =>
      assertValidHomeImage({
        home: {
          image: {
            src: "/img/hero.png",
            alt: "",
            width: 1200,
            height: 630,
            darkSrc: "/img/hero dark (1).png",
          },
        },
      }),
    ).not.toThrow();
  });

  it.each([
    ["https://example.com/a.png"],
    ["//cdn.example.com/a.png"],
    ["data:image/png;base64,AAAA"],
    ["img/hero.png"],
    [""],
    ["/img\\hero.png"],
    ["/img/hero.png\n"],
    ["/img/hero\u0085.png"],
  ])("rejects src %j", (src) => {
    expect(() => assertValidHomeImage({ home: { image: { src } } })).toThrow(
      /home\.image\.src .*root-absolute site path/,
    );
  });

  it("rejects an external darkSrc", () => {
    expect(() =>
      assertValidHomeImage({
        home: { image: { src: "/a.png", darkSrc: "https://example.com/b.png" } },
      }),
    ).toThrow(/home\.image\.darkSrc/);
  });

  it.each([[true], ["/img/hero.png"], [[]], [null]])("rejects a non-object image %j", (image) => {
    expect(() => assertValidHomeImage({ home: { image } })).toThrow(/Invalid home\.image /);
  });

  it("rejects a missing src and unknown keys", () => {
    expect(() => assertValidHomeImage({ home: { image: {} } })).toThrow(/home\.image\.src/);
    expect(() =>
      assertValidHomeImage({ home: { image: { src: "/a.png", dark: "/b.png" } } }),
    ).toThrow(/unknown key "dark"/);
  });

  it("rejects a non-string alt", () => {
    expect(() => assertValidHomeImage({ home: { image: { src: "/a.png", alt: 1 } } })).toThrow(
      /home\.image\.alt/,
    );
  });

  it("requires width and height together, as positive integers", () => {
    expect(() =>
      assertValidHomeImage({ home: { image: { src: "/a.png", width: 1200 } } }),
    ).toThrow(/width and height must be given together/);
    for (const bad of [0, -1, 1.5, "1200", Number.NaN]) {
      expect(() =>
        assertValidHomeImage({ home: { image: { src: "/a.png", width: bad, height: 630 } } }),
      ).toThrow(/home\.image\.width .*positive integer/);
    }
  });
});

describe("isRootAbsoluteSitePath", () => {
  it("classifies paths", () => {
    expect(isRootAbsoluteSitePath("/")).toBe(true);
    expect(isRootAbsoluteSitePath("/a b.png")).toBe(true);
    expect(isRootAbsoluteSitePath("//a")).toBe(false);
    expect(isRootAbsoluteSitePath("a")).toBe(false);
  });
});
