import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const showcaseRouteStubs = [
  "pages/docs/[[...slug]].tsx",
  "pages/[locale]/docs/[[...slug]].tsx",
  "pages/v/[version]/docs/[[...slug]].tsx",
  "pages/v/[version]/[locale]/docs/[[...slug]].tsx",
];

describe("showcase HtmlPreview binding path", () => {
  it("leaves HtmlPreview to the package binding on every chrome route", () => {
    const configSource = readFileSync(
      resolve(repoRoot, "zfb.config.ts"),
      "utf8",
    );
    const bindingsSource = readFileSync(
      resolve(repoRoot, "src/chrome-bindings.tsx"),
      "utf8",
    );
    const mdxExtrasStart = bindingsSource.indexOf("const mdxExtras = {");
    const mdxExtrasEnd = bindingsSource.indexOf("\n};", mdxExtrasStart);
    expect(mdxExtrasStart).toBeGreaterThanOrEqual(0);
    expect(mdxExtrasEnd).toBeGreaterThan(mdxExtrasStart);

    // Comments elsewhere in this host module mention HtmlPreview. Restrict
    // the guard to the actual object so it proves the package default remains
    // the real binding without depending on unrelated prose.
    const mdxExtrasBlock = bindingsSource.slice(mdxExtrasStart, mdxExtrasEnd);
    expect(mdxExtrasBlock).not.toMatch(/(?:^|\n)\s*HtmlPreview\s*:/m);
    expect(configSource).toContain(
      'chromeBindingsModule: "./src/chrome-bindings.tsx"',
    );

    for (const routeStub of showcaseRouteStubs) {
      const source = readFileSync(resolve(repoRoot, routeStub), "utf8");
      expect(source).toContain("createChrome(routeCtx, chromeBindings)");
    }
  });
});
