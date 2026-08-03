import type { UserChoices } from "./prompts.js";
import { capitalize, getSecondaryLang, getLangLabel } from "./utils.js";

/**
 * Programmatically generate the ONE `zfb.config.ts` a scaffolded project
 * ships (epic zudolab/zudo-doc#2651, minimal-scaffold Wave 6 #2660).
 *
 * Replaces the former `settings-gen.ts` + `zfb-config-gen.ts` pair: there is
 * no more `src/config/settings.ts` — every user choice becomes a field
 * passed straight into `zudoDoc({ ... })` (`@takazudo/zudo-doc/config`),
 * which merges it over the package's own documented defaults and returns a
 * complete `ZfbConfig`.
 *
 * DIFF-FROM-DEFAULTS (locked, #2653 Decision 2): only fields whose resolved
 * value differs from the matching `ZudoDocConfig` `@default` are emitted —
 * `siteName` is the one field always emitted. `DEFAULT_MIRROR` below is a
 * hand-kept copy of `packages/zudo-doc/src/config.ts`'s `DEFAULT_SETTINGS`
 * for exactly the fields this generator ever sets. It has to be a local
 * mirror (not an import) because `create-zudo-doc` does not depend on
 * `@takazudo/zudo-doc` at generator-build time — the package is only ever a
 * runtime dependency of the SCAFFOLDED project, never of the generator
 * itself. Keep this mirror in sync by hand whenever `DEFAULT_SETTINGS`
 * changes for one of the fields listed here.
 */

// ---------------------------------------------------------------------------
// DEFAULT_MIRROR — see the file header. Only fields this generator can ever
// set need an entry; anything else is simply never emitted.
// ---------------------------------------------------------------------------

export const DEFAULT_MIRROR: Record<string, unknown> = {
  colorScheme: "Default Dark",
  colorMode: {
    defaultMode: "dark",
    lightScheme: "Default Light",
    darkScheme: "Default Dark",
    respectPrefersColorScheme: true,
  },
  themePack: "default",
  themePackSwitcher: false,
  themePacks: undefined,
  siteName: "Docs",
  minifyHtml: true,
  defaultLocale: "en",
  locales: {},
  noindex: false,
  githubUrl: false,
  metaTags: {
    description: true,
    keywords: false,
    ogImage: false,
    ogSiteName: true,
    twitterCard: false,
  },
  docTags: false,
  tagGovernance: "off",
  tagVocabulary: false,
  llmsTxt: false,
  cjkFriendly: false,
  designTokenPanel: false,
  sidebarResizer: false,
  sidebarToggle: false,
  imageEnlarge: false,
  findInPage: false,
  dynamicPageTransition: false,
  docHistory: false,
  docHistoryExclude: [],
  bodyFootUtilArea: false,
  versions: false,
  claudeResources: false,
  defaultLocaleOnlyPrefixes: [],
  footer: false,
  headerNav: [],
  headerRightItems: [{ type: "component", component: "theme-toggle" }],
};

/** Marker wrapper: emit `code` verbatim instead of JSON-serializing it. */
interface RawCode {
  __rawCode: string;
}
function raw(code: string): RawCode {
  return { __rawCode: code };
}
function isRawCode(value: unknown): value is RawCode {
  return (
    typeof value === "object" &&
    value !== null &&
    "__rawCode" in (value as Record<string, unknown>)
  );
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ak = Object.keys(a as object);
    const bk = Object.keys(b as object);
    if (ak.length !== bk.length) return false;
    return ak.every((k) =>
      deepEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
    );
  }
  return false;
}

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function serializeValue(value: unknown, indent: number): string {
  const pad = "  ".repeat(indent);
  const padInner = "  ".repeat(indent + 1);
  if (isRawCode(value)) return value.__rawCode;
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value
      .map((v) => `${padInner}${serializeValue(v, indent + 1)}`)
      .join(",\n");
    return `[\n${items},\n${pad}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    );
    if (entries.length === 0) return "{}";
    const items = entries
      .map(([k, v]) => {
        const key = IDENT_RE.test(k) ? k : JSON.stringify(k);
        return `${padInner}${key}: ${serializeValue(v, indent + 1)}`;
      })
      .join(",\n");
    return `{\n${items},\n${pad}}`;
  }
  throw new Error(`zfb-config-gen: cannot serialize value ${String(value)}`);
}

// ---------------------------------------------------------------------------
// Desired-config builder — mirrors every user-choice → settings mapping the
// old settings-gen.ts had, but as a plain object instead of emitted lines.
// ---------------------------------------------------------------------------

function buildDesiredConfig(choices: UserChoices): Record<string, unknown> {
  const desired: Record<string, unknown> = {};

  // siteName is ALWAYS emitted (locked spec — the one field you almost
  // always set, and the clearest anchor in a near-empty config file).
  desired.siteName = capitalize(choices.projectName.replace(/-/g, " "));

  // ── Color scheme ──────────────────────────────────────────────────────
  if (choices.colorSchemeMode === "single") {
    desired.colorScheme = choices.singleScheme ?? "Default Dark";
    desired.colorMode = false;
  } else {
    desired.colorScheme = choices.darkScheme ?? "Default Dark";
    desired.colorMode = {
      defaultMode: choices.defaultMode ?? "dark",
      lightScheme: choices.lightScheme ?? "Default Light",
      darkScheme: choices.darkScheme ?? "Default Dark",
      respectPrefersColorScheme: choices.respectPrefersColorScheme ?? true,
    };
  }

  // ── Theme pack (ADR #2818 Decision 7) ────────────────────────────────
  // themePacks (the enabled-slugs allowlist) is intentionally NOT set here —
  // it is an advanced, hand-edited-only field with no CLI/prompt surface
  // (locked spec, #2823).
  desired.themePack = choices.themePack ?? "default";
  desired.themePackSwitcher = choices.features.includes("themePackSwitcher");

  // ── i18n ──────────────────────────────────────────────────────────────
  desired.defaultLocale = choices.defaultLang ?? "en";
  if (choices.features.includes("i18n")) {
    const secondaryLang = getSecondaryLang(choices.defaultLang);
    desired.locales = {
      [secondaryLang]: {
        label: getLangLabel(secondaryLang),
        dir: `src/content/docs-${secondaryLang}`,
      },
    };
  } else {
    desired.locales = {};
  }

  // ── Misc site fields ──────────────────────────────────────────────────
  desired.minifyHtml = choices.minifyHtml ?? true;
  desired.noindex = choices.features.includes("noindex");
  const rawGithubUrl =
    typeof choices.githubUrl === "string" ? choices.githubUrl.trim() : "";
  desired.githubUrl = rawGithubUrl ? rawGithubUrl : false;
  desired.cjkFriendly = choices.cjkFriendly ?? false;

  // ── Meta tags ─────────────────────────────────────────────────────────
  if (choices.metaTags) {
    const mt = choices.metaTags;
    desired.metaTags = {
      description: mt.description !== undefined ? mt.description : true,
      keywords: mt.keywords !== undefined ? mt.keywords : false,
      ogImage: mt.ogImage !== undefined ? mt.ogImage : false,
      ogSiteName: mt.ogSiteName !== undefined ? mt.ogSiteName : true,
      ...(mt.twitterCard
        ? {
            twitterCard: mt.twitterCard,
            ...(mt.twitterSite ? { twitterSite: mt.twitterSite } : {}),
            ...(mt.twitterCreator
              ? { twitterCreator: mt.twitterCreator }
              : {}),
          }
        : { twitterCard: false as const }),
    };
  }

  // ── Tags / docs ───────────────────────────────────────────────────────
  desired.docTags = choices.features.includes("docTags");
  if (choices.features.includes("tagGovernance")) {
    // The explicit tag CLI config is also the zfb source of truth, so the
    // package-owned bins and runtime settings cannot drift.
    desired.tagGovernance = raw("tagCliConfig.governance");
    desired.tagVocabulary = raw("tagCliConfig.vocabularyActive");
    desired.tagVocabularyEntries = raw("tagCliConfig.vocabulary");
  } else {
    desired.tagGovernance = "off";
    desired.tagVocabulary = false;
  }

  desired.llmsTxt = choices.features.includes("llmsTxt");

  // ── Feature toggles ───────────────────────────────────────────────────
  desired.designTokenPanel = choices.features.includes("designTokenPanel");
  desired.sidebarResizer = choices.features.includes("sidebarResizer");
  desired.sidebarToggle = choices.features.includes("sidebarToggle");
  desired.imageEnlarge = choices.features.includes("imageEnlarge");
  // findInPage rides the existing tauri feature (#2690) — the Cmd/Ctrl+F find
  // bar only makes sense inside the Tauri desktop shell, so it has no CLI
  // flag or prompt of its own; there is no separate "findInPage" feature
  // module.
  desired.findInPage = choices.features.includes("tauri");
  desired.dynamicPageTransition = choices.features.includes(
    "dynamicPageTransition",
  );
  desired.docHistory = choices.features.includes("docHistory");

  if (choices.features.includes("bodyFootUtil")) {
    desired.bodyFootUtilArea = {
      docHistory: choices.features.includes("docHistory"),
      viewSourceLink: Boolean(rawGithubUrl),
    };
  } else {
    desired.bodyFootUtilArea = false;
  }

  desired.versions = choices.features.includes("versioning") ? [] : false;

  if (choices.features.includes("claudeResources")) {
    desired.claudeResources = { claudeDir: ".claude" };
    desired.defaultLocaleOnlyPrefixes = [
      "/docs/claude-md/",
      "/docs/claude-skills/",
      "/docs/claude-agents/",
      "/docs/claude-commands/",
    ];
  } else {
    desired.claudeResources = false;
    desired.defaultLocaleOnlyPrefixes = [];
  }

  // ── Footer ────────────────────────────────────────────────────────────
  if (
    choices.features.includes("footerNavGroup") ||
    choices.features.includes("footerCopyright") ||
    choices.features.includes("footerTaglist")
  ) {
    const footer: Record<string, unknown> = {
      links: choices.features.includes("footerNavGroup")
        ? [
            {
              title: "Docs",
              items: [
                { label: "Getting Started", href: "/docs/getting-started" },
              ],
            },
          ]
        : [],
    };
    if (choices.features.includes("footerCopyright")) {
      footer.copyright = `Copyright © ${new Date().getFullYear()} Your Name. Built with zudo-doc.`;
    }
    if (choices.features.includes("footerTaglist")) {
      footer.taglist = { enabled: true, groupBy: "group" };
    }
    desired.footer = footer;
  } else {
    desired.footer = false;
  }

  // ── Header nav / header-right ────────────────────────────────────────
  const headerNav: Array<Record<string, unknown>> = [
    {
      label: "Getting Started",
      path: "/docs/getting-started",
      categoryMatch: "getting-started",
    },
  ];
  // The "claude" categoryMatch is load-bearing beyond the header link — see
  // the old settings-gen.ts note (preserved): getCategoryOrder() derives the
  // satellite-grouping prefixes from headerNav.
  if (choices.features.includes("claudeResources")) {
    headerNav.push({
      label: "Claude",
      path: "/docs/claude",
      categoryMatch: "claude",
    });
  }
  if (choices.features.includes("changelog")) {
    headerNav.push({
      label: "Changelog",
      path: "/docs/changelog",
      categoryMatch: "changelog",
    });
  }
  desired.headerNav = headerNav;

  if (choices.headerRightItems !== undefined) {
    // User-supplied override (including empty array) — emit verbatim.
    desired.headerRightItems = choices.headerRightItems;
  } else {
    const items: Array<Record<string, unknown>> = [];
    if (choices.features.includes("designTokenPanel")) {
      items.push({ type: "trigger", trigger: "design-token-panel" });
    }
    if (choices.features.includes("versioning")) {
      items.push({ type: "component", component: "version-switcher" });
    }
    if (rawGithubUrl) {
      items.push({ type: "component", component: "github-link" });
    }
    items.push({ type: "component", component: "theme-toggle" });
    if (choices.features.includes("search")) {
      items.push({ type: "component", component: "search" });
    }
    if (choices.features.includes("i18n")) {
      items.push({ type: "component", component: "language-switcher" });
    }
    desired.headerRightItems = items;
  }

  return desired;
}

// ---------------------------------------------------------------------------
// Field order — purely cosmetic (mirrors ZudoDocConfig's declaration order
// in packages/zudo-doc/src/config.ts so the emitted file reads like the
// documented reference). Any key produced by buildDesiredConfig() that is
// missing here is appended AFTER the ordered ones in ALPHABETICAL order (see
// orderDesiredKeys) — defensive: a newly-added desired key someone forgot to
// list here still emits deterministically instead of being silently dropped.
// ---------------------------------------------------------------------------

const FIELD_ORDER = [
  "colorScheme",
  "colorMode",
  "themePack",
  "themePackSwitcher",
  "themePacks",
  "siteName",
  "defaultLocale",
  "locales",
  "noindex",
  "githubUrl",
  "metaTags",
  "docTags",
  "tagGovernance",
  "tagVocabulary",
  "tagVocabularyEntries",
  "llmsTxt",
  "cjkFriendly",
  "designTokenPanel",
  "sidebarResizer",
  "sidebarToggle",
  "imageEnlarge",
  "findInPage",
  "dynamicPageTransition",
  "docHistory",
  "bodyFootUtilArea",
  "versions",
  "claudeResources",
  "defaultLocaleOnlyPrefixes",
  "footer",
  "headerNav",
  "headerRightItems",
  "minifyHtml",
  "strictContentBridge",
];

/**
 * Deterministic emission order for the keys of a `desired` config object:
 * the keys present in `FIELD_ORDER` first (cosmetic reference order), then any
 * leftover keys NOT in `FIELD_ORDER` appended in ALPHABETICAL order. The
 * leftover branch exists so a key `buildDesiredConfig()` produces but nobody
 * added to `FIELD_ORDER` is still emitted (deterministically) rather than
 * silently dropped — matching what the `FIELD_ORDER` comment promises.
 */
export function orderDesiredKeys(desiredKeys: readonly string[]): string[] {
  const inOrder = FIELD_ORDER.filter((k) => desiredKeys.includes(k));
  const leftover = desiredKeys
    .filter((k) => !FIELD_ORDER.includes(k))
    .sort();
  return [...inOrder, ...leftover];
}

/**
 * Generate the full `zfb.config.ts` source: `defineConfig(zudoDoc({ ... }))`
 * with only the diff-from-defaults fields.
 */
export function generateZfbConfig(choices: UserChoices): string {
  const desired = buildDesiredConfig(choices);

  const emittedEntries: Array<[string, unknown]> = [];
  for (const key of orderDesiredKeys(Object.keys(desired))) {
    const value = desired[key];
    // siteName always emitted (locked spec); everything else diff-from-default.
    // A leftover key not in DEFAULT_MIRROR has `DEFAULT_MIRROR[key] ===
    // undefined`, so it never deep-equals a real value and always emits.
    if (key !== "siteName" && deepEqual(value, DEFAULT_MIRROR[key])) continue;
    emittedEntries.push([key, value]);
  }

  const lines: string[] = [];
  lines.push(`import { defineConfig } from "zfb/config";`);
  lines.push(`import { zudoDoc } from "@takazudo/zudo-doc/config";`);
  if (choices.features.includes("tagGovernance")) {
    lines.push(`import tagCliConfig from "./src/config/tag-vocabulary";`);
  }
  lines.push(``);
  lines.push(`export default defineConfig(`);
  lines.push(`  zudoDoc({`);
  for (const [key, value] of emittedEntries) {
    lines.push(`    ${key}: ${serializeValue(value, 2)},`);
  }
  lines.push(`  }),`);
  lines.push(`);`);

  return lines.join("\n") + "\n";
}
