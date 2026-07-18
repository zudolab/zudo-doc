import fs from "fs-extra";
import path from "path";
import pc from "picocolors";

// ── Ejectable component map (Decision 2 — C0 #2359) ──────────────────────────
//
// Keys are the CLI name (= subpath tail of the package export).
// Values are the local destination dir (project-relative POSIX, no trailing
// slash) where the component source will be copied.
//
// This is the single source of truth for the ejectable list.
// packages/zudo-doc/scripts/copy-eject-sources.mjs and check-eject-sources.mjs
// import this constant so all three are always in sync (S4 de-dup — #2373).

export type PrimaryChromeSlot =
  | "Header"
  | "Footer"
  | "Sidebar"
  | "Toc"
  | "Breadcrumb"
  | "DocPager";

export type EjectableClassification =
  | {
      kind: "primary";
      /** The matching primary replacement key in `ChromeHostBindings`. */
      slot: PrimaryChromeSlot;
    }
  | {
      kind: "nested";
      /** Exact supported binding or owner-replacement instructions. */
      remediation: string;
    }
  | {
      kind: "content";
      /** Exact project-owned MDX registration instructions. */
      remediation: string;
    };

export interface EjectableEntry {
  /** Package subpath, e.g. `@takazudo/zudo-doc/header` */
  packageSubpath: string;
  /** Local destination dir, project-relative POSIX (no trailing slash) */
  localDir: string;
  /** Static rendering/binding class. Never infer this from host call sites. */
  classification: EjectableClassification;
}

export const EJECTABLE: Record<string, EjectableEntry> = {
  header: {
    packageSubpath: "@takazudo/zudo-doc/header",
    localDir: "src/components/zudo-doc/header",
    classification: { kind: "primary", slot: "Header" },
  },
  footer: {
    packageSubpath: "@takazudo/zudo-doc/footer",
    localDir: "src/components/zudo-doc/footer",
    classification: { kind: "primary", slot: "Footer" },
  },
  breadcrumb: {
    packageSubpath: "@takazudo/zudo-doc/breadcrumb",
    localDir: "src/components/zudo-doc/breadcrumb",
    classification: { kind: "primary", slot: "Breadcrumb" },
  },
  toc: {
    packageSubpath: "@takazudo/zudo-doc/toc",
    localDir: "src/components/zudo-doc/toc",
    classification: { kind: "primary", slot: "Toc" },
  },
  sidebar: {
    packageSubpath: "@takazudo/zudo-doc/sidebar",
    localDir: "src/components/zudo-doc/sidebar",
    classification: { kind: "primary", slot: "Sidebar" },
  },
  "theme-toggle": {
    packageSubpath: "@takazudo/zudo-doc/theme-toggle",
    localDir: "src/components/zudo-doc/theme-toggle",
    classification: {
      kind: "nested",
      remediation:
        "Register the local ThemeToggle under a new name in " +
        "chromeBindings.headerRightComponents, then use that same name in " +
        "settings.headerRightItems. The built-in name \"theme-toggle\" is reserved.",
    },
  },
  "page-loading": {
    packageSubpath: "@takazudo/zudo-doc/page-loading",
    localDir: "src/components/zudo-doc/page-loading",
    classification: {
      kind: "nested",
      remediation:
        "Replace chromeBindings.BodyEndIslands with a project-owned composition " +
        "that imports the local PageLoadingOverlay.",
    },
  },
  "tab-item": {
    packageSubpath: "@takazudo/zudo-doc/tab-item",
    localDir: "src/components/zudo-doc/tab-item",
    classification: {
      kind: "content",
      remediation: "Set chromeBindings.mdxExtras.TabItem to the local TabItem.",
    },
  },
  "doc-pager": {
    packageSubpath: "@takazudo/zudo-doc/doc-pager",
    localDir: "src/components/zudo-doc/doc-pager",
    classification: { kind: "primary", slot: "DocPager" },
  },
  "content-admonition": {
    packageSubpath: "@takazudo/zudo-doc/content-admonition",
    localDir: "src/components/zudo-doc/content-admonition",
    classification: {
      kind: "content",
      remediation:
        "Create the local admonition renderers with makeAdmonition, then set the " +
        "matching chromeBindings.mdxExtras keys (Note, Tip, Info, Warning, and Danger).",
    },
  },
  "code-group": {
    packageSubpath: "@takazudo/zudo-doc/code-group",
    localDir: "src/components/zudo-doc/code-group",
    classification: {
      kind: "content",
      remediation: "Set chromeBindings.mdxExtras.CodeGroup to the local CodeGroup.",
    },
  },
  details: {
    packageSubpath: "@takazudo/zudo-doc/details",
    localDir: "src/components/zudo-doc/details",
    classification: {
      kind: "content",
      remediation: "Set chromeBindings.mdxExtras.Details to the local Details component.",
    },
  },
  "sidebar-tree-island": {
    packageSubpath: "@takazudo/zudo-doc/sidebar-tree-island",
    localDir: "src/components/zudo-doc/sidebar-tree-island",
    classification: {
      kind: "nested",
      remediation:
        "Replace the chromeBindings.Sidebar primary component with a project-owned " +
        "sidebar composition that imports the local SidebarTree island.",
    },
  },
  "sidebar-toggle-island": {
    packageSubpath: "@takazudo/zudo-doc/sidebar-toggle-island",
    localDir: "src/components/zudo-doc/sidebar-toggle-island",
    classification: {
      kind: "nested",
      remediation:
        "Replace the chromeBindings.Header primary component with a project-owned " +
        "header composition that imports the local SidebarToggle island.",
    },
  },
  "desktop-sidebar-toggle-island": {
    packageSubpath: "@takazudo/zudo-doc/desktop-sidebar-toggle-island",
    localDir: "src/components/zudo-doc/desktop-sidebar-toggle-island",
    classification: {
      kind: "nested",
      remediation:
        "Disable settings.sidebarToggle, then replace the chromeBindings.Sidebar " +
        "primary component with a project-owned composition that imports the local " +
        "DesktopSidebarToggle island.",
    },
  },
  "image-enlarge": {
    packageSubpath: "@takazudo/zudo-doc/image-enlarge",
    localDir: "src/components/zudo-doc/image-enlarge",
    classification: {
      kind: "nested",
      remediation:
        "Replace chromeBindings.BodyEndIslands with a project-owned composition " +
        "that imports the local ImageEnlarge island.",
    },
  },
  "doc-history": {
    packageSubpath: "@takazudo/zudo-doc/doc-history",
    localDir: "src/components/zudo-doc/doc-history",
    classification: {
      kind: "nested",
      remediation: "Set chromeBindings.DocHistory to the local DocHistory component.",
    },
  },
  "site-tree-nav-island": {
    packageSubpath: "@takazudo/zudo-doc/site-tree-nav-island",
    localDir: "src/components/zudo-doc/site-tree-nav-island",
    classification: {
      kind: "nested",
      remediation:
        "Set chromeBindings.mdxExtras.SiteTreeNav to a project-owned wrapper that " +
        "imports the local SiteTreeNav island. A project-owned home route must also " +
        "use that wrapper if its home grid should change.",
    },
  },
};

const CUSTOMIZING_GUIDE_URL =
  "https://zudo-doc.takazudomodular.com/docs/reference/customizing/";
const MDX_EXTRAS_GUIDE_URL =
  "https://zudo-doc.takazudomodular.com/docs/guides/custom-components/#global-registration-mdxextras";

function assertNeverClassification(value: never): never {
  throw new Error(`Unknown ejectable classification: ${JSON.stringify(value)}`);
}

function chromeRemediation(classification: EjectableClassification): string {
  switch (classification.kind) {
    case "primary":
      return (
        `Export the local component as chromeBindings.${classification.slot} ` +
        `(the ${classification.slot} primary replacement slot) from your ` +
        "chromeBindingsModule."
      );
    case "nested":
      return classification.remediation;
    case "content":
      throw new Error("Content-layer ejectables do not use chrome remediation.");
    default:
      return assertNeverClassification(classification);
  }
}

function printNoCallSiteGuidance(entry: EjectableEntry, component: string): boolean {
  const classification = entry.classification;

  if (classification.kind === "content") {
    console.log(
      pc.dim(
        `  No host call sites found for ${entry.packageSubpath}.\n` +
          `  This is expected for a content-layer copy. ${classification.remediation}\n` +
          `  Guide: ${MDX_EXTRAS_GUIDE_URL}`,
      ),
    );
    return false;
  }

  console.warn(
    pc.bold(pc.red(`\nWARNING: the ejected ${component} copy is not wired into your site.`)) +
      `\nThis component is rendered by package chrome. The source was copied to ` +
      `${entry.localDir}, but no host import referenced ${entry.packageSubpath}.\n` +
      pc.bold("Editing the copy will not change your site until you bind it.") +
      `\nRemediation: ${chromeRemediation(classification)}` +
      `\nCustomization guide: ${CUSTOMIZING_GUIDE_URL}\n`,
  );
  return true;
}

// ── .zudo-doc.json schema ─────────────────────────────────────────────────────

export interface ZudoDocJson {
  /** @takazudo/zudo-doc version the ejected source came from */
  packageVersion: string;
  /** component name → local dir (project-relative POSIX, no trailing slash) */
  ejected: Record<string, string>;
}

// ── Import-rewiring ────────────────────────────────────────────────────────────
//
// Decision 4 — C0 #2359:
//   - Same-dir relatives (./foo.js) → kept verbatim.
//   - Parent-relative cross-component (../<seg>/...) → rewritten to
//     @takazudo/zudo-doc/<seg>.
//
// Implementation: single deterministic regex over each copied file's text.
// All verified parent-relatives go exactly one level up to a sibling top-level
// dir — the mapping is `../<seg>/<rest>` → `@takazudo/zudo-doc/<seg>`.
//
// Transitions barrel note (C0-flagged ambiguity, resolved):
//   `../transitions/page-events.js` rewrites to `@takazudo/zudo-doc/transitions`.
//   The `transitions` barrel (packages/zudo-doc/src/transitions/index.ts) DOES
//   re-export all page-events symbols (BEFORE_NAVIGATE_EVENT, AFTER_NAVIGATE_EVENT,
//   onBeforeNavigate, onAfterNavigate), so the rewrite is safe — callers importing
//   only those symbols from `@takazudo/zudo-doc/transitions` will find them.

/**
 * Rewrite parent-relative cross-component imports (`../<seg>/<rest>`) to
 * `@takazudo/zudo-doc/<seg>` in-place across all `.ts`/`.tsx` files in `dir`.
 */
async function rewireImports(dir: string): Promise<void> {
  // Match: from "...<seg>/<rest>.js" where ... is `from "` or `from '`
  // Capture group 1 = quote char, group 2 = seg
  const re = /(from\s+)(["'])\.\.\/([\w-]+)\/[^"']+\2/g;

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (!/\.[cm]?[jt]sx?$/.test(entry.name)) continue;

    const filePath = path.join(dir, entry.name);
    const original = await fs.readFile(filePath, "utf8");

    const rewritten = original.replace(re, (_, from, quote, seg) => {
      return `${from}${quote}@takazudo/zudo-doc/${seg}${quote}`;
    });

    if (rewritten !== original) {
      await fs.writeFile(filePath, rewritten, "utf8");
    }
  }
}

// ── Host call site rewiring ───────────────────────────────────────────────────

/**
 * Scan `src/**` and `pages/**` under `projectRoot` for imports of the ejected
 * package subpath and rewrite them to a project-relative path to `localDir`.
 *
 * Returns the number of files rewritten.
 */
async function rewireHostCallSites(
  projectRoot: string,
  component: string,
  localDir: string,
): Promise<number> {
  const packageSubpath = EJECTABLE[component]!.packageSubpath;
  const destinationDir = path.resolve(projectRoot, localDir);
  // Escape the subpath for use in a RegExp literal
  const escapedSubpath = packageSubpath.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&");
  const re = new RegExp(`(from\\s+)(["'])${escapedSubpath}\\2`, "g");

  const searchDirs = [
    path.join(projectRoot, "src"),
    path.join(projectRoot, "pages"),
  ];

  let rewroteCount = 0;

  for (const searchDir of searchDirs) {
    if (!(await fs.pathExists(searchDir))) continue;

    const rewriteDir = async (dir: string, relFromProject: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const abs = path.join(dir, entry.name);
        const resolvedAbs = path.resolve(abs);
        // The freshly copied eject tree lives under src/**, but it is not a
        // host call site. In particular, public-entry comments can contain a
        // literal package import example that matches the rewrite regexp. If
        // we scan the destination, that example is rewritten and falsely
        // suppresses the required unwired primary/nested warning.
        if (
          resolvedAbs === destinationDir ||
          resolvedAbs.startsWith(`${destinationDir}${path.sep}`)
        ) {
          continue;
        }
        if (entry.isDirectory()) {
          await rewriteDir(abs, path.join(relFromProject, entry.name));
          continue;
        }
        if (!/\.[cm]?[jt]sx?$/.test(entry.name)) continue;

        const original = await fs.readFile(abs, "utf8");
        if (!original.includes(packageSubpath)) continue;

        // Compute the relative path from this file to the local dest dir
        const fileDir = path.join(projectRoot, relFromProject);
        let rel = path
          .relative(fileDir, destinationDir)
          .split(path.sep)
          .join("/");
        if (!rel.startsWith(".")) rel = `./${rel}`;

        const rewritten = original.replace(re, (_, from, quote) => {
          return `${from}${quote}${rel}${quote}`;
        });

        if (rewritten !== original) {
          await fs.writeFile(abs, rewritten, "utf8");
          rewroteCount++;
        }
      }
    };

    const relBase = path.relative(projectRoot, searchDir);
    await rewriteDir(searchDir, relBase);
  }

  return rewroteCount;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface EjectOptions {
  /** Project root to eject into. Defaults to `process.cwd()`. */
  cwd?: string;
  /**
   * Injectable resolver for the installed `@takazudo/zudo-doc` package root.
   * Defaults to resolving `@takazudo/zudo-doc/package.json` from `cwd`
   * node_modules. Override in tests to point at a fixture.
   */
  resolvePackageRoot?: (cwd: string) => string;
}

/**
 * Default package-root resolver: look up `@takazudo/zudo-doc/package.json`
 * relative to `cwd`.
 */
function defaultResolvePackageRoot(cwd: string): string {
  // Walk node_modules from cwd
  let dir = cwd;
  while (true) {
    const candidate = path.join(dir, "node_modules/@takazudo/zudo-doc");
    if (fs.pathExistsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not find @takazudo/zudo-doc in node_modules from ${cwd}.\n` +
      `Run \`pnpm install\` first.`,
  );
}

/**
 * Eject a single component into the project.
 *
 * - If already ejected (recorded in `.zudo-doc.json`): prints a notice and
 *   exits cleanly (safe no-op — never clobbers local edits).
 * - Otherwise: copies the TS source from the installed package's `eject/`
 *   tree, rewires parent-relative imports, rewrites host call sites, and
 *   records the entry in `.zudo-doc.json`.
 */
export async function eject(
  component: string,
  options: EjectOptions = {},
): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const resolvePackageRoot = options.resolvePackageRoot ?? defaultResolvePackageRoot;

  // 1. Validate component name
  if (!Object.prototype.hasOwnProperty.call(EJECTABLE, component)) {
    const valid = Object.keys(EJECTABLE).sort().join(", ");
    console.error(
      pc.red(`Unknown component "${component}".`) +
        `\nEjectable components: ${valid}`,
    );
    process.exit(1);
  }

  const entry = EJECTABLE[component]!;
  const localDir = entry.localDir;
  const destAbs = path.join(cwd, localDir);

  // 2. Read .zudo-doc.json
  const provenancePath = path.join(cwd, ".zudo-doc.json");
  let provenance: ZudoDocJson = { packageVersion: "unknown", ejected: {} };
  if (await fs.pathExists(provenancePath)) {
    try {
      provenance = await fs.readJson(provenancePath) as ZudoDocJson;
    } catch {
      // Corrupt file — treat as empty
      provenance = { packageVersion: "unknown", ejected: {} };
    }
  }

  // 3. Idempotency check
  if (Object.prototype.hasOwnProperty.call(provenance.ejected, component)) {
    const recorded = provenance.ejected[component];
    console.log(
      pc.yellow(`already ejected at ${recorded}`) +
        ` — skipping (re-eject is a safe no-op)`,
    );
    return;
  }

  // Secondary guard: destination dir already exists but not recorded
  if (await fs.pathExists(destAbs)) {
    console.log(
      pc.yellow(`Destination ${localDir} already exists`) +
        ` but is not recorded in .zudo-doc.json.\n` +
        `Treating as already ejected — skipping to avoid clobbering local edits.\n` +
        `If you want to re-eject, remove the directory and its .zudo-doc.json entry manually.`,
    );
    return;
  }

  // 4. Resolve installed package root
  let pkgRoot: string;
  try {
    pkgRoot = resolvePackageRoot(cwd);
  } catch (err) {
    console.error(pc.red(String(err)));
    process.exit(1);
  }

  // 5. Check eject source exists
  const ejectSrcDir = path.join(pkgRoot, "eject", component);
  if (!(await fs.pathExists(ejectSrcDir))) {
    const pkgJsonPath = path.join(pkgRoot, "package.json");
    let version = "unknown";
    try {
      const pkgJson = await fs.readJson(pkgJsonPath) as { version?: string };
      version = pkgJson.version ?? "unknown";
    } catch { /* ignore */ }
    console.error(
      pc.red(
        `@takazudo/zudo-doc@${version} does not ship eject sources for "${component}".\n` +
          `Bump @takazudo/zudo-doc to a version that includes the eject/ tree and retry.`,
      ),
    );
    process.exit(1);
  }

  // 6. Read installed package version for provenance
  let installedVersion = provenance.packageVersion;
  try {
    const pkgJson = await fs.readJson(path.join(pkgRoot, "package.json")) as { version?: string };
    installedVersion = pkgJson.version ?? installedVersion;
  } catch { /* use existing */ }

  // 7. Copy the source tree
  await fs.ensureDir(destAbs);
  await fs.copy(ejectSrcDir, destAbs);
  console.log(pc.green(`Copied ${component} source → ${localDir}`));

  // 8. Rewrite parent-relative cross-component imports
  await rewireImports(destAbs);
  console.log(pc.dim(`  Rewired cross-component imports in ${localDir}`));

  // 9. Rewrite host call sites
  const rewroteCount = await rewireHostCallSites(cwd, component, localDir);
  let unwiredChrome = false;
  if (rewroteCount > 0) {
    console.log(
      pc.dim(`  Rewrote ${rewroteCount} host file(s) to import from ${localDir}`),
    );
  } else {
    unwiredChrome = printNoCallSiteGuidance(entry, component);
  }

  // 10. Update .zudo-doc.json provenance
  provenance.packageVersion = installedVersion;
  provenance.ejected[component] = localDir;
  await fs.writeJson(provenancePath, provenance, { spaces: 2 });
  console.log(pc.green(`Updated .zudo-doc.json`));

  const status = unwiredChrome
    ? `${pc.yellow("⚠")} Copied ${component}, but it is not wired into the rendered site`
    : `${pc.green("✓")} Ejected ${component}`;
  console.log(
    pc.bold(
      `\n${status} from @takazudo/zudo-doc@${installedVersion}\n` +
        `  Source:      node_modules/@takazudo/zudo-doc/eject/${component}/\n` +
        `  Destination: ${localDir}/\n` +
        `  Provenance:  .zudo-doc.json\n`,
    ),
  );
}
