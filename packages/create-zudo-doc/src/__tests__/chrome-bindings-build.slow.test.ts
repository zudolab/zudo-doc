/**
 * Generated-project chrome customization matrix (#2778).
 *
 * The fast scaffold suite freezes all four docHistory × i18n source shapes.
 * This slow tier adds a real bindings module with representative primary
 * replacements to every shape, then production-builds the two endpoints of
 * the matrix (base and i18n+docHistory). Together they prove all six primary
 * slots, partial/default behavior, named header-right SSR, MDX bindings, and
 * the doc-history overlay without multiplying the network/build tier by four.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { scaffold } from "../scaffold.js";
import type { UserChoices } from "../prompts.js";
import {
  installScaffoldedDeps,
  overrideWithLocalZudoDoc,
  runOrThrow,
} from "./slow-build-helpers.js";

type PrimarySlot =
  | "Header"
  | "Footer"
  | "Sidebar"
  | "Toc"
  | "Breadcrumb"
  | "DocPager";

interface MatrixCase {
  name: string;
  features: UserChoices["features"];
  slots: PrimarySlot[];
  registry: boolean;
  build: boolean;
}

const cases: MatrixCase[] = [
  {
    name: "base",
    features: [],
    slots: ["Header", "Footer", "Sidebar"],
    registry: false,
    build: true,
  },
  {
    name: "i18n",
    features: ["i18n"],
    slots: ["Sidebar", "Toc"],
    registry: true,
    build: false,
  },
  {
    name: "doc-history",
    features: ["docHistory"],
    slots: ["Breadcrumb", "DocPager"],
    registry: true,
    build: false,
  },
  {
    name: "i18n-doc-history",
    features: ["i18n", "docHistory"],
    slots: ["Toc", "Breadcrumb", "DocPager"],
    registry: true,
    build: true,
  },
];

const componentSources: Record<PrimarySlot, string> = {
  Header: `Header: (props: HeaderSlotProps) => (
    <header data-matrix-primary="Header" data-exact-props={\`${"${props.lang}"}|${"${props.currentSlug ?? \"\"}"}|${"${props.currentPath ?? \"\"}"}\`} />
  )`,
  Footer: `Footer: (props: FooterSlotProps) => (
    <footer data-matrix-primary="Footer" data-exact-props={props.lang} />
  )`,
  Sidebar: `Sidebar: (props: SidebarSlotProps) => (
    <aside data-matrix-primary="Sidebar" data-exact-props={\`${"${props.lang}"}|${"${props.currentSlug}"}|${"${props.currentPath}"}\`} />
  )`,
  Toc: `Toc: (props: TocSlotProps) => (
    <nav data-matrix-primary="Toc" data-exact-props={\`${"${props.title}"}|${"${props.headings.length}"}\`} />
  )`,
  Breadcrumb: `Breadcrumb: (props: BreadcrumbSlotProps) => (
    <nav data-matrix-primary="Breadcrumb" data-exact-props={\`${"${props.items.length}"}|${"${props.rightSlot == null ? \"no\" : \"yes\"}"}\`}>{props.rightSlot}</nav>
  )`,
  DocPager: `DocPager: (props: DocPagerSlotProps) => (
    <nav data-matrix-primary="DocPager" data-exact-props={\`${"${props.locale}"}|${"${props.prev == null ? \"none\" : \"prev\"}"}|${"${props.next == null ? \"none\" : \"next\"}"}\`} />
  )`,
};

// spawnSync captures raw stdout/stderr bytes. picocolors treats `CI=true`
// (set by GitHub Actions, incl. the nightly slow-test run) as color support
// even though the piped stream isn't a TTY, so the eject CLI's nested
// pc.bold(...pc.green("✓")...) composition inserts an ANSI reset between "✓"
// and " Ejected <component>" — breaking a plain substring check. Strip ANSI
// once here so every assertion below tests human-visible text, not byte
// adjacency (mirrors packages/zudo-doc/src/__tests__/eject.test.ts).
const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "g");

const TEMP_PREFIX = "create-zudo-doc-chrome-matrix-";
const projectDirs = new Map<string, string>();
let tempDir: string;
let originalCwd: string;
const ejectProofs = new Map<string, ReturnType<typeof spawnSync>>();

function projectName(testCase: MatrixCase): string {
  return `chrome-matrix-${testCase.name}`;
}

function bindingsSource(testCase: MatrixCase): string {
  const typeImports = testCase.slots
    .map((slot) => `type ${slot}SlotProps`)
    .join(",\n  ");
  const slotEntries = testCase.slots.map((slot) => componentSources[slot]);
  const registryEntry = testCase.registry
    ? `headerRightComponents: {
    "matrix-badge": function MatrixHeaderBadge({ item, index, lang, hasLocales }) {
      return (
        <strong
          data-matrix-header-right={\`${"${item.component}"}:${"${lang ?? \"default\"}"}:${"${index}"}:${"${hasLocales}"}\`}
        >Matrix badge</strong>
      );
    },
  }`
    : "";
  const docHistoryAttempt = testCase.features.includes("docHistory")
    ? 'DocHistory: () => <span data-virtual-doc-history="must-not-render" />'
    : "";
  const entries = [
    ...slotEntries,
    registryEntry,
    docHistoryAttempt,
    "mdxExtras: { MatrixBadge }",
  ]
    .filter(Boolean)
    .join(",\n  ");

  return `/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import {
  defineChromeBindings,
  ${typeImports},
} from "@takazudo/zudo-doc/chrome-bindings";

function MatrixBadge() {
  return <span data-matrix-mdx="reachable">Matrix MDX</span>;
}

export const chromeBindings = defineChromeBindings({
  ${entries},
});
`;
}

async function configureProject(testCase: MatrixCase, projectDir: string): Promise<void> {
  const configPath = path.join(projectDir, "zfb.config.ts");
  const config = await fs.readFile(configPath, "utf8");
  const headerItems = `    headerRightItems: [
      { type: "link", href: "/before", label: "Before" },
      { type: "component", component: "matrix-badge" },
      { type: "link", href: "/after", label: "After" },
    ],`;
  let nextConfig = config.replace(
      /siteName: ([^,]+),/,
      `siteName: $1,\n    chromeBindingsModule: "./src/chrome-bindings.tsx",`,
    );
  if (testCase.registry) {
    const existingHeaderItems = /    headerRightItems: \[\n[\s\S]*?\n    \],/;
    nextConfig = existingHeaderItems.test(nextConfig)
      ? nextConfig.replace(existingHeaderItems, headerItems)
      : nextConfig.replace(
          '    chromeBindingsModule: "./src/chrome-bindings.tsx",',
          `    chromeBindingsModule: "./src/chrome-bindings.tsx",\n${headerItems}`,
        );
  }
  await fs.writeFile(configPath, nextConfig);
  await fs.writeFile(
    path.join(projectDir, "src/chrome-bindings.tsx"),
    bindingsSource(testCase),
  );
  await fs.appendFile(
    path.join(
      projectDir,
      "src/content/docs/getting-started/introduction.mdx",
    ),
    "\n\n<MatrixBadge />\n",
  );
  if (testCase.features.includes("i18n")) {
    await fs.appendFile(
      path.join(
        projectDir,
        "src/content/docs-ja/getting-started/introduction.mdx",
      ),
      "\n\n<MatrixBadge />\n",
    );
  }
}

function readBuiltDoc(projectDir: string, locale?: "ja"): Promise<string> {
  return fs.readFile(
    path.join(
      projectDir,
      "dist",
      ...(locale ? [locale] : []),
      "docs/getting-started/introduction/index.html",
    ),
    "utf8",
  );
}

function htmlAttr(name: string, value: string): RegExp {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${name}=(?:"${escaped}"|${escaped})(?:[\\s>])`);
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  process.chdir(tempDir);

  for (const testCase of cases) {
    const name = projectName(testCase);
    await scaffold({
      projectName: name,
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: testCase.features,
      packageManager: "pnpm",
    });
    const projectDir = path.join(tempDir, name);
    projectDirs.set(testCase.name, projectDir);
    await configureProject(testCase, projectDir);

    if (testCase.build) {
      installScaffoldedDeps(projectDir);
      overrideWithLocalZudoDoc(projectDir);
      runOrThrow("pnpm check", projectDir, { SKIP_DOC_HISTORY: "1" });
      runOrThrow("pnpm build", projectDir, { SKIP_DOC_HISTORY: "1" });
      if (testCase.name === "base") {
        for (const component of ["header", "theme-toggle", "details"]) {
          const proof = spawnSync(
            "pnpm",
            ["exec", "zudo-doc", "eject", component],
            { cwd: projectDir, encoding: "utf8" },
          );
          ejectProofs.set(component, proof);
          if (proof.status !== 0) {
            throw new Error(
              `Real generated-project ${component} eject failed:\n${proof.stdout}\n${proof.stderr}`,
            );
          }
        }
        runOrThrow("pnpm check", projectDir, { SKIP_DOC_HISTORY: "1" });
        runOrThrow("pnpm build", projectDir, { SKIP_DOC_HISTORY: "1" });
      }
    }
  }
}, 12 * 60 * 1000);

afterAll(async () => {
  process.chdir(originalCwd);
  if (tempDir && (await fs.pathExists(tempDir))) await fs.remove(tempDir);
});

describe("generated chrome customization matrix", () => {
  it("generates all four route shapes with one preserved bindings object", async () => {
    for (const testCase of cases) {
      const projectDir = projectDirs.get(testCase.name)!;
      const stubs = [
        path.join(projectDir, "pages/docs/[[...slug]].tsx"),
        ...(testCase.features.includes("i18n")
          ? [path.join(projectDir, "pages/[locale]/docs/[[...slug]].tsx")]
          : []),
      ];
      for (const stubPath of stubs) {
        const stub = await fs.readFile(stubPath, "utf8");
        expect(stub).toContain(
          'import { chromeBindings } from "virtual:zudo-doc-chrome-bindings";',
        );
        if (testCase.features.includes("docHistory")) {
          expect(stub).toContain("...chromeBindings");
          expect(stub).toContain("...defineChromeBindings({ DocHistory })");
        } else {
          expect(stub).toContain("createChrome(routeCtx, chromeBindings)");
        }
      }
      const moduleSource = await fs.readFile(
        path.join(projectDir, "src/chrome-bindings.tsx"),
        "utf8",
      );
      for (const slot of testCase.slots) {
        expect(moduleSource).toContain(`${slot}:`);
      }
    }
  });

  it("production-builds all six primary replacements and package defaults", async () => {
    const baseHtml = await readBuiltDoc(projectDirs.get("base")!);
    for (const slot of ["Header", "Footer", "Sidebar"]) {
      expect(baseHtml).toMatch(htmlAttr("data-matrix-primary", slot));
    }
    expect(baseHtml).toMatch(htmlAttr("data-zfb-island", "Toc"));
    expect(baseHtml).toMatch(htmlAttr("aria-label", "Breadcrumb"));
    expect(baseHtml).toContain("mt-vsp-2xl grid grid-cols-2");
    expect(baseHtml).toMatch(htmlAttr("data-matrix-mdx", "reachable"));

    const combinedHtml = await readBuiltDoc(projectDirs.get("i18n-doc-history")!);
    for (const slot of ["Toc", "Breadcrumb", "DocPager"]) {
      expect(combinedHtml).toMatch(htmlAttr("data-matrix-primary", slot));
    }
    expect(combinedHtml).toContain("data-header");
    expect(combinedHtml).toMatch(htmlAttr("data-zfb-island", "SidebarTree"));
    expect(combinedHtml).toContain("<footer");
    expect(combinedHtml).toMatch(/data-zfb-island-skip-ssr=(?:"DocHistory"|DocHistory)/);
    expect(combinedHtml).not.toContain("data-virtual-doc-history");
    expect(combinedHtml).not.toMatch(htmlAttr("data-zfb-island", "Toc"));
  });

  it("reports primary, nested, and content eject paths truthfully in a real generated project", async () => {
    const outputFor = (component: string): string => {
      const proof = ejectProofs.get(component)!;
      expect(proof.status).toBe(0);
      return `${proof.stdout}\n${proof.stderr}`.replace(ANSI_ESCAPE, "");
    };
    const headerOutput = outputFor("header");
    expect(headerOutput).toContain("WARNING: the ejected header copy is not wired");
    expect(headerOutput).toContain("chromeBindings.Header");
    expect(headerOutput).not.toContain("Rewrote 1 host file(s)");

    const nestedOutput = outputFor("theme-toggle");
    expect(nestedOutput).toContain(
      "WARNING: the ejected theme-toggle copy is not wired",
    );
    expect(nestedOutput).toContain("chromeBindings.headerRightComponents");

    const contentOutput = outputFor("details");
    expect(contentOutput).not.toContain("WARNING");
    expect(contentOutput).toContain("This is expected for a content-layer copy");
    expect(contentOutput).toContain("chromeBindings.mdxExtras.Details");
    expect(contentOutput).toContain("✓ Ejected details");

    const projectDir = projectDirs.get("base")!;
    for (const component of ["header", "theme-toggle", "details"]) {
      expect(
        await fs.pathExists(
          path.join(projectDir, "src/components/zudo-doc", component),
        ),
      ).toBe(true);
    }
    expect(
      await fs.readJson(path.join(projectDir, ".zudo-doc.json")),
    ).toMatchObject({
      ejected: {
        header: "src/components/zudo-doc/header",
        "theme-toggle": "src/components/zudo-doc/theme-toggle",
        details: "src/components/zudo-doc/details",
      },
    });
  });

  it("renders the named header item at its exact index/context on EN and JA SSR", async () => {
    const projectDir = projectDirs.get("i18n-doc-history")!;
    for (const [locale, expected] of [
      [undefined, "matrix-badge:en:1:true"],
      ["ja", "matrix-badge:ja:1:true"],
    ] as const) {
      const html = await readBuiltDoc(projectDir, locale);
      expect(html).toMatch(htmlAttr("data-matrix-header-right", expected));
      const positions = ["/before", "data-matrix-header-right", "/after"].map(
        (marker) => html.indexOf(marker),
      );
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      // Host registry renderers are intentionally SSR-presentational. Package
      // islands (Sidebar + DocHistory) keep their hydration markers.
      expect(html).not.toMatch(htmlAttr("data-zfb-island", "MatrixHeaderBadge"));
      expect(html).toMatch(htmlAttr("data-zfb-island", "SidebarTree"));
      expect(html).toMatch(/data-zfb-island-skip-ssr=(?:"DocHistory"|DocHistory)/);
      expect(html).toMatch(htmlAttr("data-matrix-mdx", "reachable"));
    }
  });
});
