import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as breadcrumb from "../breadcrumb/index.js";
import * as codeBlockEnhancerModule from "../code-syntax/code-block-enhancer.js";
import * as codeSyntax from "../code-syntax/index.js";
import * as mermaidInitModule from "../code-syntax/mermaid-init.js";
import * as tabsInitModule from "../code-syntax/tabs-init.js";
import * as tabsModule from "../code-syntax/tabs.js";
import * as content from "../content/index.js";
import type { BodyEndIslandsSettings } from "../doc-body-end-islands/index.js";
import type { HeaderProps } from "../header/index.js";

// These expected errors are compile-time guards for removed compatibility
// names. Vitest erases the type-only imports; the package typecheck verifies
// that none of them can reappear without making the directive unused.
// @ts-expect-error SidebarNode belongs to ./sidebar-tree, not ./breadcrumb.
import type { SidebarNode as RemovedBreadcrumbSidebarNode } from "../breadcrumb/index.js";
// @ts-expect-error Use defaultComponents.
import type { htmlOverrides as RemovedHtmlOverrides } from "../content/index.js";
// @ts-expect-error Use the named CodeBlockEnhancer export.
import type { CodeBlockEnhancerDefault as RemovedCodeBlockEnhancerDefault } from "../code-syntax/index.js";
// @ts-expect-error The component module has no compatibility default export.
import type RemovedCodeBlockEnhancerDefaultExport from "../code-syntax/code-block-enhancer.js";
// @ts-expect-error Use the named MermaidInit export.
import type { MermaidInitDefault as RemovedMermaidInitDefault } from "../code-syntax/index.js";
// @ts-expect-error The component module has no compatibility default export.
import type RemovedMermaidInitDefaultExport from "../code-syntax/mermaid-init.js";
// @ts-expect-error The generated default Mermaid script is internal to MermaidInit.
import type { MERMAID_INIT_SCRIPT as RemovedMermaidInitScript } from "../code-syntax/index.js";
// @ts-expect-error Use the named Tabs export.
import type { TabsDefault as RemovedTabsDefault } from "../code-syntax/index.js";
// @ts-expect-error The component module has no compatibility default export.
import type RemovedTabsDefaultExport from "../code-syntax/tabs.js";
// @ts-expect-error Use the named TabsInit export.
import type { TabsInitDefault as RemovedTabsInitDefault } from "../code-syntax/index.js";
// @ts-expect-error The component module has no compatibility default export.
import type RemovedTabsInitDefaultExport from "../code-syntax/tabs-init.js";

type Expect<T extends true> = T;
type IsRequired<T, K extends keyof T> = {} extends Pick<T, K> ? false : true;

type HeaderPersistKeyIsRequired = Expect<IsRequired<HeaderProps, "persistKey">>;
type DynamicPageTransitionIsRequired = Expect<
  IsRequired<BodyEndIslandsSettings, "dynamicPageTransition">
>;
type DesignTokenPanelIsRequired = Expect<
  IsRequired<BodyEndIslandsSettings, "designTokenPanel">
>;
type FindInPageIsRequired = Expect<
  IsRequired<BodyEndIslandsSettings, "findInPage">
>;

describe("collapsed compatibility package boundary", () => {
  it("retains the current breadcrumb and content names only", () => {
    expect(breadcrumb).toHaveProperty("Breadcrumb");
    expect(breadcrumb).not.toHaveProperty("SidebarNode");
    expect(content).toHaveProperty("defaultComponents");
    expect(content).not.toHaveProperty("htmlOverrides");
  });

  it("retains named code-syntax components without compatibility aliases", () => {
    expect(codeSyntax).toHaveProperty("CodeBlockEnhancer");
    expect(codeSyntax).toHaveProperty("MermaidInit");
    expect(codeSyntax).toHaveProperty("Tabs");
    expect(codeSyntax).toHaveProperty("TabsInit");
    expect(codeSyntax).not.toHaveProperty("CodeBlockEnhancerDefault");
    expect(codeSyntax).not.toHaveProperty("MermaidInitDefault");
    expect(codeSyntax).not.toHaveProperty("MERMAID_INIT_SCRIPT");
    expect(codeSyntax).not.toHaveProperty("TabsDefault");
    expect(codeSyntax).not.toHaveProperty("TabsInitDefault");
  });

  it("removes the empty component-module default exports", () => {
    expect(codeBlockEnhancerModule).not.toHaveProperty("default");
    expect(mermaidInitModule).not.toHaveProperty("default");
    expect(tabsModule).not.toHaveProperty("default");
    expect(tabsInitModule).not.toHaveProperty("default");
  });

  it("exports only the explicit safelist.css subpath", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(__dirname, "../../package.json"), "utf8"),
    ) as { exports: Record<string, unknown> };

    expect(packageJson.exports).toHaveProperty("./safelist.css");
    expect(packageJson.exports).not.toHaveProperty("./safelist");
  });
});
