import { describe, expect, it } from "vitest";

import {
  generateLlmsFullTxt,
  generateLlmsTxt,
} from "../generate.js";
import {
  LLMS_ASSET_TEXT_CAP_BYTES,
  type LlmsAssetEntry,
  type LlmsDocEntry,
} from "../types.js";

const meta = {
  siteName: "Example Docs",
  siteDescription: "Documentation for the example project",
};

const docs: LlmsDocEntry[] = [
  {
    title: "Introduction",
    description: "Get started",
    url: "/docs/intro",
    content: "Welcome.",
    sidebarPosition: undefined,
  },
];

describe("llms asset generators", () => {
  it("keeps the legacy index output byte-identical when assets are absent", () => {
    const expected = [
      "# Example Docs",
      "",
      "> Documentation for the example project",
      "",
      "## Docs",
      "",
      "- [Introduction](/docs/intro): Get started",
      "",
    ].join("\n");

    expect(generateLlmsTxt(docs, meta)).toBe(expected);
    expect(generateLlmsTxt(docs, meta, [])).toBe(expected);
  });

  it("keeps the legacy full output byte-identical when assets are absent", () => {
    const expected = [
      "# Example Docs",
      "",
      "> Documentation for the example project",
      "",
      "---",
      "",
      "# Introduction",
      "",
      "> Source: /docs/intro",
      "",
      "Welcome.",
      "",
    ].join("\n");

    expect(generateLlmsFullTxt(docs, meta)).toBe(expected);
    expect(generateLlmsFullTxt(docs, meta, [])).toBe(expected);
  });

  it("adds a Files section after Docs without changing the Docs entries", () => {
    const asset: LlmsAssetEntry = {
      path: "guide.txt",
      url: "/files/guide.txt/",
      isText: true,
      content: "A guide.",
    };
    const output = generateLlmsTxt(docs, meta, [asset]);

    expect(output).toContain("## Docs\n\n- [Introduction](/docs/intro): Get started\n\n## Files\n");
    expect(output).toContain("- [guide.txt](/files/guide.txt/)");
    expect(output.indexOf("## Files")).toBeGreaterThan(output.indexOf("## Docs"));
  });

  it("appends text assets to full output and marks a capped body", () => {
    const asset: LlmsAssetEntry = {
      path: "large.txt",
      url: "/files/large.txt/",
      isText: true,
      content: "x".repeat(LLMS_ASSET_TEXT_CAP_BYTES + 12),
    };
    const output = generateLlmsFullTxt(docs, meta, [asset]);
    const expectedBody = `${"x".repeat(LLMS_ASSET_TEXT_CAP_BYTES)}\n… (truncated)`;

    expect(output).toContain("# large.txt");
    expect(output).toContain("> Source: /files/large.txt/");
    expect(output).toContain(expectedBody);
    expect(output).not.toContain("x".repeat(LLMS_ASSET_TEXT_CAP_BYTES + 1));
  });

  it("uses a one-line stub and never inlines binary content", () => {
    const asset: LlmsAssetEntry = {
      path: "archive.bin",
      url: "/files/archive.bin/",
      isText: false,
      content: "secret binary-looking text",
    };
    const output = generateLlmsFullTxt(docs, meta, [asset]);

    expect(output).toContain("# archive.bin");
    expect(output).toContain("> Source: /files/archive.bin/");
    expect(output).toContain("(binary asset, not inlined)");
    expect(output).not.toContain("secret binary-looking text");
  });
});
