// Snapshot guard for the @takazudo/zudo-doc 1.0 public API contract.
//
// Covers two previously-unguarded surfaces:
//   (a) package.json#exports keyset
//   (b) Settings / PresetSettings public field set
//
// The doclayout slot anchors and @theme design tokens are already guarded by
// existing tooling (check:template-drift and design-token-lint respectively)
// and are NOT duplicated here — see packages/zudo-doc/API.md for references.
//
// packageOwnedRoutes is a stable, default-on field (#2404 made it the default;
// create-zudo-doc always emits it) and is included in the field-set snapshot
// below like every other public Settings field.

import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// src/__tests__/ → src/ → packages/zudo-doc/
const pkgRoot = resolve(__dirname, "../..");

// ── (a) package.json#exports keyset ──────────────────────────────────────────
//
// Fails when a subpath is added or removed without a deliberate, reviewed
// snapshot update. To update: run the test, inspect the diff, and update the
// snapshot with `vitest run --update-snapshots`.

describe("package.json exports keyset snapshot", () => {
  it("matches the frozen 1.0 exports keyset", () => {
    const require = createRequire(import.meta.url);
    const pkgJson = require(resolve(pkgRoot, "package.json")) as {
      exports: Record<string, unknown>;
    };

    const exportKeys = Object.keys(pkgJson.exports).sort();

    // Snapshot the sorted keyset — any addition or removal breaks this test.
    expect(exportKeys).toMatchInlineSnapshot(`
      [
        ".",
        "./ai-chat-modal",
        "./body-foot-util",
        "./breadcrumb",
        "./category-nav",
        "./category-tree-nav",
        "./chrome",
        "./code-group",
        "./code-syntax",
        "./color-scheme-utils",
        "./color-schemes-defaults",
        "./component-tokens",
        "./compose-meta-title",
        "./config",
        "./content",
        "./content-admonition",
        "./content.css",
        "./design-token-panel-bootstrap",
        "./desktop-sidebar-toggle-island",
        "./details",
        "./directive-vocabulary-defaults",
        "./doc-body-end",
        "./doc-body-end-islands",
        "./doc-content-header",
        "./doc-history",
        "./doc-history-area",
        "./doc-metainfo-area",
        "./doc-page-props",
        "./doc-page-renderer",
        "./doc-page-shell",
        "./doc-pager",
        "./doc-route-entries",
        "./doc-route-paths",
        "./doc-tags-area",
        "./doclayout",
        "./docs-schema",
        "./eject",
        "./extract-headings",
        "./factory-context",
        "./features.css",
        "./footer",
        "./footer-with-defaults",
        "./frontmatter-preview-data",
        "./frontmatter-preview-defaults",
        "./github-helpers",
        "./head",
        "./head-with-defaults",
        "./header",
        "./header-with-defaults",
        "./home-page",
        "./html-preview-wrapper",
        "./i18n-defaults",
        "./i18n-version",
        "./icons",
        "./image-enlarge",
        "./inline-version-switcher",
        "./integrations/changelog",
        "./integrations/claude-resources",
        "./integrations/doc-history",
        "./integrations/llms-txt",
        "./integrations/search-index",
        "./island-types",
        "./locale-merge",
        "./math-block",
        "./mdx-components",
        "./mermaid-enlarge",
        "./metainfo",
        "./nav-data-prep",
        "./nav-indexing",
        "./nav-indexing/types",
        "./nav-scope",
        "./nav-source-cache",
        "./nav-source-docs",
        "./page-loading",
        "./page-loading.css",
        "./plugins/changelog",
        "./plugins/claude-resources",
        "./plugins/doc-history",
        "./plugins/llms-txt",
        "./plugins/routes",
        "./plugins/search-index",
        "./preset",
        "./render-markdown",
        "./robots",
        "./route-context",
        "./route-enumerators",
        "./routes/404",
        "./routes/api-ai-chat",
        "./routes/docs-slug",
        "./routes/docs-tags-index",
        "./routes/docs-tags-tag",
        "./routes/docs-versions",
        "./routes/index",
        "./routes/locale-docs-slug",
        "./routes/locale-docs-tags-index",
        "./routes/locale-docs-tags-tag",
        "./routes/locale-docs-versions",
        "./routes/locale-index",
        "./routes/robots.txt",
        "./routes/sitemap.xml",
        "./routes/v-docs-slug",
        "./routes/v-locale-docs-slug",
        "./safelist",
        "./safelist.css",
        "./search-widget",
        "./search-widget-script",
        "./settings",
        "./sidebar",
        "./sidebar-active-slug",
        "./sidebar-filter",
        "./sidebar-prepaint",
        "./sidebar-resizer",
        "./sidebar-toggle-island",
        "./sidebar-tree",
        "./sidebar-tree-island",
        "./sidebar-utils",
        "./sidebar-with-defaults",
        "./sidebar/types",
        "./site-tree-nav",
        "./site-tree-nav-island",
        "./slug",
        "./smart-break",
        "./tab-item",
        "./tag-helpers",
        "./tag-pages",
        "./tags-audit",
        "./theme",
        "./theme-toggle",
        "./theme.css",
        "./theme/color-scheme-provider",
        "./toc",
        "./transitions",
        "./tree-nav-shared",
        "./tsconfig.base.json",
        "./url-helpers",
        "./url-normalizer",
        "./use-modal-dialog",
        "./versions-page",
        "./virtual-modules.d.ts",
        "./z-index-defaults",
        "./zfb-config-shim.d.ts",
      ]
    `);
  });
});

// ── (b) Settings / PresetSettings public field set ────────────────────────────
//
// Reads Settings interface field names from the compiled dist/settings.js.
// Because TypeScript interfaces erase to nothing at runtime, we extract the
// field names from the source text of settings.ts via a simple regex — this
// avoids any coupling to tsup output format while staying robust against
// accidental field additions or removals.
//
// packageOwnedRoutes is INCLUDED: it is a stable, default-on field (#2404)
// documented in API.md alongside every other public Settings field.

describe("Settings public field set snapshot", () => {
  it("matches the frozen 1.0 stable field set", async () => {
    const fs = await import("node:fs/promises");
    const settingsSrc = await fs.readFile(
      resolve(pkgRoot, "src/settings.ts"),
      "utf8",
    );

    // Extract the Settings interface body — everything between
    // `export interface Settings {` and the closing `}`.
    // We look for lines of the form `  fieldName` or `  fieldName?` at the top
    // of an interface body (single-level indent, no deeper nesting).
    const settingsMatch = settingsSrc.match(
      /export interface Settings \{([\s\S]*?)\n\}/,
    );
    if (!settingsMatch) {
      throw new Error("Could not locate `export interface Settings {` in settings.ts");
    }

    const interfaceBody = settingsMatch[1]!;

    // Match field declarations:  fieldName or  fieldName?  (leading spaces, no extra indent)
    const fieldRe = /^\s{2}(\w+)\??\s*:/gm;
    const fields: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = fieldRe.exec(interfaceBody)) !== null) {
      const name = m[1]!;
      fields.push(name);
    }

    expect(fields).toMatchInlineSnapshot(`
      [
        "colorScheme",
        "colorMode",
        "siteName",
        "siteDescription",
        "base",
        "trailingSlash",
        "minifyHtml",
        "docsDir",
        "defaultLocale",
        "locales",
        "mermaid",
        "noindex",
        "editUrl",
        "githubUrl",
        "githubAutolinksRepo",
        "siteUrl",
        "metaTags",
        "head",
        "sitemap",
        "docMetainfo",
        "docTags",
        "tagPlacement",
        "tagGovernance",
        "tagVocabulary",
        "llmsTxt",
        "changelogs",
        "math",
        "cjkFriendly",
        "onBrokenMarkdownLinks",
        "aiAssistant",
        "aiChatDemoMode",
        "aiChatAllowedOrigins",
        "aiChatGlobalDailyLimit",
        "designTokenPanel",
        "tocMinDepth",
        "tocMaxDepth",
        "headingIdStrategy",
        "sidebarResizer",
        "sidebarToggle",
        "imageEnlarge",
        "dynamicPageTransition",
        "frontmatterPreview",
        "docHistory",
        "bodyFootUtilArea",
        "htmlPreview",
        "versions",
        "claudeResources",
        "defaultLocaleOnlyPrefixes",
        "footer",
        "headerNav",
        "headerRightItems",
        "packageOwnedRoutes",
        "chromeBindingsModule",
      ]
    `);
  });
});
