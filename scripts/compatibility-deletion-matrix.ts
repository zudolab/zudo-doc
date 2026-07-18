/**
 * Current-only compatibility deletion matrix (#2772).
 *
 * This is data consumed by check-compatibility-contract.ts. Every deletion is
 * tied to an executable proof kind; adding prose-only rows is intentionally
 * impossible. Historical changelogs and current platform/dependency behavior
 * are represented separately as narrowly scoped survivor classifications.
 */

export type AbsentPathProof = {
  kind: "paths-absent";
  paths: readonly string[];
};

export type PackageExportProof = {
  kind: "package-exports-absent";
  packageJson: string;
  subpaths: readonly string[];
};

export type TextAbsenceProof = {
  kind: "text-absent";
  paths: readonly string[];
  terms: readonly string[];
  /** Tests may name deleted contracts in negative assertions. */
  excludePathPatterns?: readonly string[];
};

export type TextPresenceProof = {
  kind: "text-present";
  paths: readonly string[];
  terms: readonly string[];
};

export type CanonicalTagsProof = {
  kind: "canonical-tags";
};

export type MatrixProof =
  | AbsentPathProof
  | PackageExportProof
  | TextAbsenceProof
  | TextPresenceProof
  | CanonicalTagsProof;

export type DeletionMatrixRow = {
  issue: number;
  category:
    | "file"
    | "export/subpath"
    | "symbol"
    | "config value"
    | "storage key"
    | "input shape"
    | "selector"
    | "CLI flag"
    | "generated string";
  removed: string;
  proof: MatrixProof;
};

// Exact negative-proof files may name a deleted contract while asserting its
// rejection. No test directory is blanket-excluded: positive fixtures remain
// visible to the matrix scan.
const negativeTestExclusions = [
  // Compile-time/runtime package alias and export rejection.
  "^packages/zudo-doc/src/__tests__/compatibility-package-boundary\\.test\\.ts$",
  // Explicit removed heading config rejection.
  "^packages/zudo-doc/src/__tests__/config\\.test\\.ts$",
  // CSS/route output assertions that Syntect selectors are absent.
  "^packages/zudo-doc/src/__tests__/features-css\\.test\\.ts$",
  "^packages/zudo-doc/src/__tests__/route-injection-build\\.slow\\.test\\.ts$",
  "^packages/zudo-doc/src/code-syntax/__tests__/code-block-enhancer\\.test\\.tsx$",
  // Provider regression asserts the deleted localStorage bridge is untouched.
  "^packages/zudo-doc/src/theme/__tests__/color-scheme-provider\\.test\\.tsx$",
  // Removed doc-history exports are asserted absent.
  "^packages/doc-history-server/src/__tests__/git-history-contract\\.test\\.ts$",
  // Generator manifest/config negative proofs name forbidden output strings.
  "^packages/create-zudo-doc/src/__tests__/scaffold\\.test\\.ts$",
  "^packages/create-zudo-doc/src/__tests__/zfb-config-gen\\.test\\.ts$",
  "scripts/compatibility-deletion-matrix\\.ts$",
  "scripts/check-compatibility-contract\\.ts$",
];

export const deletionMatrix: readonly DeletionMatrixRow[] = [
  {
    issue: 2760,
    category: "file",
    removed: "legacy host DesignTokenPanel bootstrap files",
    proof: {
      kind: "paths-absent",
      paths: [
        "src/components/design-token-panel-bootstrap.tsx",
        "src/lib/design-token-panel-bootstrap.ts",
      ],
    },
  },
  {
    issue: 2760,
    category: "input shape",
    removed: "plain PanelConfig bootstrap input",
    proof: {
      kind: "text-absent",
      paths: ["packages/zudo-doc/src/design-token-panel-bootstrap.tsx"],
      terms: ["PanelConfig | PanelConfigBuilder", "instanceof PanelConfig"],
      excludePathPatterns: negativeTestExclusions,
    },
  },
  {
    issue: 2761,
    category: "file",
    removed: "repository-owned token SerDe, types, export modal, iframe bridge, and sole-purpose tests",
    proof: {
      kind: "paths-absent",
      paths: [
        "packages/zudo-doc/src/theme/design-token-serde.ts",
        "packages/zudo-doc/src/theme/design-token-types.ts",
        "packages/zudo-doc/src/theme/color-tweak-export-modal.tsx",
        "packages/zudo-doc/src/theme/iframe-bridge.ts",
        "packages/zudo-doc/src/theme/__tests__/design-token-serde.test.ts",
      ],
    },
  },
  {
    issue: 2761,
    category: "symbol",
    removed: "legacy repository-owned token schemas, persisted-state types, and iframe bridge API",
    proof: {
      kind: "text-absent",
      paths: ["packages/zudo-doc/src/theme"],
      terms: [
        "DesignTokenSchemaError",
        "DESIGN_TOKEN_SCHEMA",
        "ColorTweakState",
        "DesignTokenJson",
        "DesignTokenManifest",
        "TokenOverrides",
        "installIframeReceiver",
        "sendApplyCssVars",
        "sendClearCssVars",
        "BRIDGE_SOURCE",
      ],
      excludePathPatterns: negativeTestExclusions,
    },
  },
  {
    issue: 2761,
    category: "storage key",
    removed: "zudo-doc-color-scheme-css localStorage bridge",
    proof: {
      kind: "text-absent",
      paths: ["packages/zudo-doc/src"],
      terms: ["zudo-doc-color-scheme-css"],
      excludePathPatterns: negativeTestExclusions,
    },
  },
  {
    issue: 2761,
    category: "input shape",
    removed: "ModeMap requiring a complete syntax map",
    proof: {
      kind: "text-present",
      paths: ["packages/zudo-doc/src/color-scheme-utils.ts"],
      terms: ["syntax?: Partial<Record<SyntaxSemanticKey, RampRef>>"],
    },
  },
  {
    issue: 2762,
    category: "export/subpath",
    removed: "descriptor-style public integration subpaths",
    proof: {
      kind: "package-exports-absent",
      packageJson: "packages/zudo-doc/package.json",
      subpaths: [
        "./integrations/doc-history",
        "./integrations/llms-txt",
        "./integrations/search-index",
        "./integrations/claude-resources",
      ],
    },
  },
  {
    issue: 2762,
    category: "file",
    removed: "descriptor integration entrypoints and compatibility READMEs",
    proof: {
      kind: "paths-absent",
      paths: [
        "packages/zudo-doc/src/integrations/doc-history/README.md",
        "packages/zudo-doc/src/integrations/llms-txt/README.md",
        "packages/zudo-doc/src/integrations/llms-txt/index.ts",
        "packages/zudo-doc/src/integrations/search-index/README.md",
        "packages/zudo-doc/src/integrations/claude-resources/README.md",
      ],
    },
  },
  {
    issue: 2763,
    category: "export/subpath",
    removed: "bare ./safelist export",
    proof: {
      kind: "package-exports-absent",
      packageJson: "packages/zudo-doc/package.json",
      subpaths: ["./safelist"],
    },
  },
  {
    issue: 2763,
    category: "input shape",
    removed: "optional BodyEndIslands feature fields and Header persistKey",
    proof: {
      kind: "text-absent",
      paths: [
        "packages/zudo-doc/src/doc-body-end-islands/index.tsx",
        "packages/zudo-doc/src/header/types.ts",
        "packages/zudo-doc/src/header/header.tsx",
      ],
      terms: [
        "dynamicPageTransition?:",
        "designTokenPanel?:",
        "findInPage?:",
        "persistKey?:",
        "persistKey === undefined",
      ],
      excludePathPatterns: negativeTestExclusions,
    },
  },
  {
    issue: 2763,
    category: "symbol",
    removed: "package compatibility aliases and public generated Mermaid script",
    proof: {
      kind: "text-absent",
      paths: [
        "packages/zudo-doc/src/breadcrumb",
        "packages/zudo-doc/src/content",
        "packages/zudo-doc/src/code-syntax/index.ts",
        "src/config/frontmatter-preview-renderers.tsx",
      ],
      terms: [
        "type SidebarNode = BreadcrumbNode",
        "htmlOverrides",
        "CodeBlockEnhancerDefault",
        "MermaidInitDefault",
        "TabsDefault",
        "TabsInitDefault",
        "MERMAID_INIT_SCRIPT",
        "FrontmatterRendererProps",
      ],
      excludePathPatterns: negativeTestExclusions,
    },
  },
  {
    issue: 2764,
    category: "file",
    removed: "Astro-era entry type and obsolete host forwarding modules",
    proof: {
      kind: "paths-absent",
      paths: [
        "src/types/docs-entry.ts",
        "src/components/sidebar-toggle.tsx",
        "src/utils/render-markdown.ts",
        "src/utils/smart-break.tsx",
        "src/utils/slug.ts",
        "pages/lib/doc-page-props.ts",
        "pages/lib/locale-merge.ts",
      ],
    },
  },
  {
    issue: 2764,
    category: "input shape",
    removed: "synthesized Astro-style entry id and collection fields",
    proof: {
      kind: "text-absent",
      paths: ["pages/_data.ts", "src/types"],
      terms: ["id:", "collection:"],
      excludePathPatterns: negativeTestExclusions,
    },
  },
  {
    issue: 2764,
    category: "symbol",
    removed: "Astro-era DocsEntry bridge types and entry adapters",
    proof: {
      kind: "text-absent",
      paths: ["pages", "src", "packages/zudo-doc/src"],
      terms: ["interface DocsEntry", "bridgeDocsEntries"],
      excludePathPatterns: negativeTestExclusions,
    },
  },
  {
    issue: 2765,
    category: "file",
    removed: "sync git-history sole-purpose suite",
    proof: {
      kind: "paths-absent",
      paths: ["packages/doc-history-server/src/__tests__/git-history.test.ts"],
    },
  },
  {
    issue: 2765,
    category: "symbol",
    removed: "doc-history alias, compatibility async wrapper, and sync orchestration exports",
    proof: {
      kind: "text-absent",
      paths: ["packages/doc-history-server/src/git-history.ts"],
      terms: [
        "getDocHistory =",
        "getFileCommitsMetaAsync",
        "getFileCommits(",
        "getFirstCommit(",
        "getCommitInfo(",
        "getFileCommitsMeta(",
        "MAX_BUFFER_BYTES",
      ],
      excludePathPatterns: negativeTestExclusions,
    },
  },
  {
    issue: 2765,
    category: "input shape",
    removed: "doc-history manifest without required ext",
    proof: {
      kind: "text-absent",
      paths: ["packages/zudo-doc/src/plugins/internal/doc-history", "packages/zudo-doc/src/doc-history-area"],
      terms: ["meta?.ext ??", "ext?: string"],
      excludePathPatterns: negativeTestExclusions,
    },
  },
  {
    issue: 2766,
    category: "selector",
    removed: "pre[class*=syntect-] runtime/CSS/current-doc selector contract",
    proof: {
      kind: "text-absent",
      paths: [
        "packages/zudo-doc/src",
        "packages/zudo-doc/zfb-config-shim.d.ts",
        "src/content/docs",
        "src/content/docs-ja",
      ],
      terms: ["syntect-", "syntect", "Syntect"],
      excludePathPatterns: [
        ...negativeTestExclusions,
        "(^|/)changelog/",
      ],
    },
  },
  {
    issue: 2767,
    category: "config value",
    removed: "headingIdStrategy and flat heading allocation",
    proof: {
      kind: "text-absent",
      paths: [
        "packages/zudo-doc/src/settings.ts",
        "packages/zudo-doc/src/extract-headings",
        "packages/create-zudo-doc/src",
        "packages/create-zudo-doc/templates",
        "src/config",
        "src/content/docs",
        "src/content/docs-ja",
        "e2e/fixtures",
      ],
      terms: ["headingIdStrategy"],
      excludePathPatterns: negativeTestExclusions,
    },
  },
  {
    issue: 2768,
    category: "generated string",
    removed: "retired authored/template tag IDs (cf-worker, guide(s), reference, tutorial(s), beginner, advanced)",
    proof: { kind: "canonical-tags" },
  },
  {
    issue: 2768,
    category: "config value",
    removed: "host and generator tag vocabulary aliases declarations",
    proof: {
      kind: "text-absent",
      paths: [
        "src/config/tag-vocabulary.ts",
        "packages/create-zudo-doc/src/features/tag-governance.ts",
        "packages/create-zudo-doc/templates",
      ],
      terms: ["aliases:"],
      excludePathPatterns: negativeTestExclusions,
    },
  },
  {
    issue: 2769,
    category: "symbol",
    removed: "tag alias/deprecation issue types, indices, redirects, and rewrite helpers",
    proof: {
      kind: "text-absent",
      paths: [
        "packages/zudo-doc/src/settings.ts",
        "packages/zudo-doc/src/tag-helpers",
        "packages/zudo-doc/src/tags-audit.ts",
        "packages/zudo-doc/bin",
        "src/utils/tags.ts",
        "scripts",
      ],
      terms: [
        "AliasIssue",
        "DeprecatedIssue",
        "aliasToId",
        "byAlias",
        "rewriteAliasesByteStable",
        "computeRewrites",
        "aliases?:",
        "deprecated?:",
      ],
      excludePathPatterns: negativeTestExclusions,
    },
  },
  {
    issue: 2770,
    category: "file",
    removed: "project-side tag CLI shims",
    proof: {
      kind: "paths-absent",
      paths: [
        "scripts/tags-audit.ts",
        "scripts/tags-suggest.ts",
        "packages/create-zudo-doc/templates/features/tagGovernance/files/scripts/tags-audit.ts",
      ],
    },
  },
  {
    issue: 2770,
    category: "input shape",
    removed: "hard-coded tag CLI settings/vocabulary dynamic imports",
    proof: {
      kind: "text-absent",
      paths: ["packages/zudo-doc/bin"],
      terms: [
        "resolve(cwd, \"src/config/settings.ts\")",
        "resolve(cwd, \"src/config/tag-vocabulary.ts\")",
        "import(\"src/config/settings.ts\")",
        "import(\"src/config/tag-vocabulary.ts\")",
      ],
      excludePathPatterns: negativeTestExclusions,
    },
  },
  {
    issue: 2770,
    category: "file",
    removed: "duplicate generated settings module for tag governance",
    proof: {
      kind: "paths-absent",
      paths: [
        "packages/create-zudo-doc/templates/features/tagGovernance/files/src/config/settings.ts",
      ],
    },
  },
  {
    issue: 2770,
    category: "symbol",
    removed: "project-side pre-bound findNearDuplicates wrapper",
    proof: {
      kind: "text-absent",
      paths: ["packages/create-zudo-doc/templates", "packages/create-zudo-doc/src/features/tag-governance.ts"],
      terms: ["findNearDuplicates"],
      excludePathPatterns: negativeTestExclusions,
    },
  },
  {
    issue: 2770,
    category: "generated string",
    removed: "generated project-side audit shim import/invocation",
    proof: {
      kind: "text-absent",
      paths: ["packages/create-zudo-doc/templates", "packages/create-zudo-doc/src/features/tag-governance.ts"],
      terms: ["scripts/tags-audit.ts"],
      excludePathPatterns: negativeTestExclusions,
    },
  },
  {
    issue: 2771,
    category: "symbol",
    removed: "tooling-only link checker entrypoints",
    proof: {
      kind: "text-absent",
      paths: ["scripts/check-links.js"],
      terms: ["checkHtmlLinks(", "checkTrailingSlashLinks("],
      excludePathPatterns: negativeTestExclusions,
    },
  },
  {
    issue: 2771,
    category: "CLI flag",
    removed: "aggregate link-check --strict flag",
    proof: {
      kind: "text-absent",
      paths: [
        "scripts/check-links.js",
        "src/content/docs/develop/link-checker.mdx",
        "src/content/docs-ja/develop/link-checker.mdx",
        ".github/workflows/pr-checks.yml",
      ],
      terms: [
        "arg === \"--strict\"",
        "argv.includes(\"--strict\")",
        "case \"--strict\"",
        " --strict ",
      ],
      excludePathPatterns: negativeTestExclusions,
    },
  },
  {
    issue: 2771,
    category: "input shape",
    removed: "implicit ja locale and optional metaTags fallback",
    proof: {
      kind: "text-absent",
      paths: ["scripts/check-links.js", "src/lib/preset-generator-logic.ts"],
      terms: ["(?:ja/)?", "state.metaTags ?? DEFAULT_META_TAGS"],
      excludePathPatterns: negativeTestExclusions,
    },
  },
  {
    issue: 2772,
    category: "file",
    removed: "current migrating-from-v3 guidance",
    proof: {
      kind: "paths-absent",
      paths: [
        "src/content/docs/getting-started/migrating-from-v3.mdx",
        "src/content/docs-ja/getting-started/migrating-from-v3.mdx",
      ],
    },
  },
] as const;

export type SurvivorClassification = {
  marker: string;
  classification: "current-platform" | "historical" | "dependency-owned";
  allowPathPatterns: readonly string[];
  reason: string;
};

/**
 * Markers which intentionally survive the cleanup. The checker rejects each
 * occurrence outside these path patterns, so this is an executable allowlist,
 * not a prose escape hatch.
 */
export const survivorAllowlist: readonly SurvivorClassification[] = [
  {
    marker: "./integrations/changelog",
    classification: "current-platform",
    allowPathPatterns: [
      "^packages/zudo-doc/package\\.json$",
      "^packages/zudo-doc/API\\.md$",
      "^packages/zudo-doc/src/(integrations/changelog|plugins/changelog)",
      "^packages/zudo-doc/src/__tests__/",
      "^packages/create-zudo-doc/",
      "^scripts/generate-changelog\\.ts$",
    ],
    reason: "The changelog emitter/loader is the canonical implementation used by the active plugin and repository generator.",
  },
  {
    marker: "SKIP_DOC_HISTORY",
    classification: "current-platform",
    allowPathPatterns: [
      "^packages/doc-history-server/",
      "^packages/zudo-doc/src/plugins/internal/doc-history/",
      "^packages/zudo-doc/src/__tests__/",
      "^e2e/",
      "^\\.github/workflows/",
      "^CLAUDE\\.md$",
      "^packages/create-zudo-doc/src/__tests__/",
      "^packages/zudo-doc/(CLAUDE\\.md|scripts/check-plugin-resolution\\.mjs)$",
      "^packages/zudo-doc/src/(doc-history-area|extract-headings|plugins/doc-history\\.ts)",
      "^src/__tests__/",
      "^src/content/docs(-ja)?/guides/(deployment|doc-history)\\.mdx$",
      "^src/content/docs(-ja)?/reference/doc-history-server\\.mdx$",
      "^__inbox/W1B-workaround-audit\\.md$",
      "^__inbox/W2A-implementation-spec\\.md$",
      "^audits/05-footer\\.md$",
      "^audits/12-doc-history\\.md$",
      "^audits/14-pipelines\\.md$",
      "^audits/feature-checklist\\.md$",
    ],
    reason: "The environment switch keeps generated and fixture builds independent of Git history.",
  },
  {
    marker: "--follow",
    classification: "current-platform",
    allowPathPatterns: [
      "^packages/doc-history-server/",
      "^\\.github/workflows/",
      "^CLAUDE\\.md$",
      "^e2e/setup-fixtures\\.sh$",
      "^packages/zudo-doc/src/plugins/internal/doc-history/",
      "^src/content/docs(-ja)?/guides/(deployment|doc-history)\\.mdx$",
      "^src/content/docs(-ja)?/reference/doc-history-server\\.mdx$",
    ],
    reason: "Git rename-follow behavior is part of the current doc-history contract.",
  },
  {
    marker: ".shiki",
    classification: "current-platform",
    allowPathPatterns: [
      "^packages/zudo-doc/src/features\\.css$",
      "^packages/zudo-doc/src/html-preview-wrapper/",
      "^packages/zudo-doc/src/__tests__/",
      "^e2e/",
      "^src/content/docs(-ja)?/(components/code-blocks|markdown-features/syntax-highlighting)\\.mdx$",
      "^__inbox/W1A-upstream-survey\\.md$",
    ],
    reason: "Shiki remains the current client-side highlighter for HtmlPreview only; document fences use zfb class-mode markup.",
  },
  {
    marker: "zudo-doc-tweak-state-v2",
    classification: "historical",
    allowPathPatterns: [
      "^packages/zudo-doc/CHANGELOG\\.md$",
      "^src/content/docs(-ja)?/changelog/",
      "^packages/zudo-doc/src/theme-toggle/__tests__/",
      "^__inbox/zdtp-migration-confirm-report\\.md$",
      "^__inbox/zdtp-migration-gaps\\.md$",
    ],
    reason: "The old storage key survives only in immutable release history; v1-v3 migration code is dependency-owned by @takazudo/zdtp.",
  },
  {
    marker: "zudo-doc-tweak-state-v3",
    classification: "dependency-owned",
    allowPathPatterns: [
      "^packages/zudo-doc/CHANGELOG\\.md$",
      "^src/content/docs(-ja)?/changelog/",
      "^packages/zudo-doc/(eject/)?theme-toggle/color-scheme-sync\\.ts$",
      "^packages/zudo-doc/src/theme-toggle/__tests__/",
      "^\\.claude/skills/color-scheme-a11y/SKILL\\.md$",
    ],
    reason: "Repository code no longer owns this format; mentions are historical while current persistence belongs to @takazudo/zdtp.",
  },
] as const;
