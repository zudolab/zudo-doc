/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { build } from "esbuild";
import * as jsxRuntime from "@takazudo/zfb/zudo-react/jsx-runtime";
import { resolve } from "node:path";
import { buildSwitcherScripts } from "../../../scripts/gen-switcher-scripts.mjs";
import { LANGUAGE_SWITCHER_INIT_SCRIPT } from "../language-switcher.js";
import { VERSION_SWITCHER_REWIRE_SCRIPT } from "../version-switcher.js";

afterEach(() => {
  document.body.innerHTML = "";
  delete document.documentElement.dataset.zdCurrentPath;
  delete (window as unknown as Record<string, unknown>).__zdLanguageSwitcherInit;
  delete (window as unknown as Record<string, unknown>).__zdVersionSwitcherRewire;
});

describe("frozen switcher scripts", () => {
  it("matches fresh generation from the canonical URL helpers and script templates", () => {
    expect(buildSwitcherScripts()).toEqual({ LANGUAGE_SWITCHER_INIT_SCRIPT, VERSION_SWITCHER_REWIRE_SCRIPT });
  });

  it.each([false, true])("executes consumer-bundled scripts with keepNames=%s without bundle-scope helpers", async (keepNames) => {
    const result = await build({
      stdin: {
        contents: 'export { LANGUAGE_SWITCHER_INIT_SCRIPT } from "./language-switcher.tsx"; export { VERSION_SWITCHER_REWIRE_SCRIPT } from "./version-switcher.tsx";',
        resolveDir: resolve(import.meta.dirname, ".."),
      },
      bundle: true, write: false, format: "cjs", platform: "browser", keepNames,
      jsx: "automatic", jsxImportSource: "@takazudo/zfb/zudo-react",
      external: ["@takazudo/zfb", "@takazudo/zfb/*"],
    });
    const module = { exports: {} as Record<string, string> };
    new Function("module", "exports", "require", result.outputFiles[0]!.text)(module, module.exports, (name: string) => { if (name === "@takazudo/zfb/zudo-react/jsx-runtime") return jsxRuntime; throw new Error(`Unexpected import ${name}`); });
    expect(module.exports.LANGUAGE_SWITCHER_INIT_SCRIPT).toBe(LANGUAGE_SWITCHER_INIT_SCRIPT);
    expect(module.exports.VERSION_SWITCHER_REWIRE_SCRIPT).toBe(VERSION_SWITCHER_REWIRE_SCRIPT);
    document.documentElement.dataset.zdCurrentPath = "/manual/docs/next/";
    document.body.innerHTML = `<div data-language-switcher data-base="/manual" data-default-locale="en" data-current-locale="en" data-trailing-slash="true"><a lang="ja" href="/stale/">JA</a></div><div data-version-rewire data-base="/manual" data-default-locale="en" data-current-locale="en" data-trailing-slash="true"><a data-version-latest href="/stale/">Latest</a><a data-version-slug="1.0" href="/stale/">1.0</a></div>`;
    for (const script of Object.values(module.exports)) new Function("window", "document", script)(window, document);
    document.dispatchEvent(new Event("DOMContentLoaded"));
    expect(document.querySelector('a[lang="ja"]')!.getAttribute("href")).toBe("/manual/ja/docs/next/");
    expect(document.querySelector("[data-version-latest]")!.getAttribute("href")).toBe("/manual/docs/next/");
    expect(document.querySelector("[data-version-slug]")!.getAttribute("href")).toBe("/manual/v/1.0/docs/next/");
  });
});
