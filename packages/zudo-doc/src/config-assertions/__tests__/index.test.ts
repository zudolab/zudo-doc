import { describe, expect, it } from "vitest";
import {
  assertValidSearchMaxBodyLength,
  warnAmbiguousDropdownCategoryMatch,
} from "../index.js";

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
