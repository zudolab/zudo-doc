/**
 * Generated-project chrome-bindings regression test (#2774 / source #2716).
 *
 * A self-contained `pages/docs/[[...slug]].tsx` route shadows the package's
 * injected dynamic route. Before #2774 that stub called `createChrome()` with
 * no host bindings, so a valid `chromeBindingsModule` never reached document
 * MDX: custom tags such as `<MyBadge />` failed SSR even though the package's
 * injected route consumed the same virtual module correctly.
 *
 * Keep this in the slow tier. The acceptance signal is a real scaffolded
 * project build whose generated doc-route stub is left untouched: we add only
 * the documented config/module/content inputs, then assert the bound component
 * appears in emitted HTML.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { scaffold } from "../scaffold.js";
import type { UserChoices } from "../prompts.js";
import {
  runOrThrow,
  installScaffoldedDeps,
  overrideWithLocalZudoDoc,
} from "./slow-build-helpers.js";

const TEMP_PREFIX = "create-zudo-doc-chrome-bindings-build-";
const PROJECT_NAME = "chrome-bindings-build-test";

const choices: UserChoices = {
  projectName: PROJECT_NAME,
  defaultLang: "en",
  colorSchemeMode: "single",
  singleScheme: "Default Dark",
  // Keeping docHistory on proves its statically imported island survives the
  // host-binding merge at the same time as the virtual mdxExtras binding.
  features: ["docHistory"],
  packageManager: "pnpm",
};

let tempDir: string;
let projectDir: string;
let originalCwd: string;

beforeAll(async () => {
  originalCwd = process.cwd();
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  process.chdir(tempDir);

  await scaffold(choices);
  projectDir = path.join(tempDir, PROJECT_NAME);

  const configPath = path.join(projectDir, "zfb.config.ts");
  const config = await fs.readFile(configPath, "utf-8");
  await fs.writeFile(
    configPath,
    config.replace(
      /siteName: ([^,]+),/,
      'siteName: $1,\n    chromeBindingsModule: "./src/chrome-bindings.tsx",',
    ),
  );

  await fs.writeFile(
    path.join(projectDir, "src", "chrome-bindings.tsx"),
    `/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { defineChromeBindings } from "@takazudo/zudo-doc/chrome-bindings";

function MyBadge() {
  return <span data-my-badge="reachable">Bound badge</span>;
}

export const chromeBindings = defineChromeBindings({
  mdxExtras: { MyBadge },
});
`,
  );

  const docPath = path.join(
    projectDir,
    "src",
    "content",
    "docs",
    "getting-started",
    "introduction.mdx",
  );
  await fs.appendFile(docPath, "\n\n<MyBadge />\n");

  installScaffoldedDeps(projectDir);
  overrideWithLocalZudoDoc(projectDir);
  runOrThrow("pnpm build", projectDir, { SKIP_DOC_HISTORY: "1" });
}, 5 * 60 * 1000);

afterAll(async () => {
  process.chdir(originalCwd);
  if (tempDir && (await fs.pathExists(tempDir))) {
    await fs.remove(tempDir);
  }
});

describe("generated chromeBindingsModule reaches the self-contained doc route", () => {
  it("renders an mdxExtras MyBadge binding without editing the route stub", async () => {
    const html = await fs.readFile(
      path.join(
        projectDir,
        "dist",
        "docs",
        "getting-started",
        "introduction",
        "index.html",
      ),
      "utf-8",
    );
    expect(html).toMatch(/data-my-badge=(?:"reachable"|reachable)/);
    expect(html).toContain("Bound badge");
    expect(html).toMatch(
      /data-zfb-island-skip-ssr=(?:"DocHistory"|DocHistory)/,
    );
  });
});
