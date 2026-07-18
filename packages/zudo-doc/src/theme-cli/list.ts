// theme-cli/list — `zudo-doc theme list` (ADR docs/adr/theme-packs.md
// "Catalog source (offline)"): enumerate the installed package's shipped
// theme packs and mark which one the project currently has configured.
//
// Naming (hard, per the ADR + issue #2824): every identifier/output string
// here uses "theme pack" vocabulary — never bare "theme" (that word is
// hard-claimed by the light/dark mode system).

import pc from "picocolors";

import { detectActiveThemePack } from "./config-io.js";
import {
  loadInstalledThemePackCatalog,
  type LoadInstalledThemePackCatalogOptions,
} from "./registry.js";

export interface ThemeListRow {
  slug: string;
  name: string;
  mode: "light" | "dark";
  version: string;
  description: string;
  active: boolean;
}

export interface ThemeListResult {
  rows: ThemeListRow[];
  activeSlug: string;
  /** `false` when the active slug is a fallback (zfb.config.ts missing or
   *  not confidently parseable) rather than a confirmed reading. */
  activeDetected: boolean;
}

export interface ListThemePacksOptions extends LoadInstalledThemePackCatalogOptions {
  cwd?: string;
}

/** Resolve the installed catalog + the project's active pack slug. Pure
 *  data — see `formatThemeList` for the printable rendering. */
export async function listThemePacks(
  options: ListThemePacksOptions = {},
): Promise<ThemeListResult> {
  const cwd = options.cwd ?? process.cwd();
  const catalog = loadInstalledThemePackCatalog(options);
  const { slug: activeSlug, detected: activeDetected } = await detectActiveThemePack(cwd);

  const rows: ThemeListRow[] = catalog.map((entry) => ({
    slug: entry.slug,
    name: entry.meta.name,
    mode: entry.meta.mode,
    version: entry.meta.version,
    description: entry.meta.description,
    active: entry.slug === activeSlug,
  }));

  return { rows, activeSlug, activeDetected };
}

function padEnd(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

/** Render a `ListThemePacksOptions` result as a human-readable table for
 *  the terminal. Kept separate from `listThemePacks` so tests can assert on
 *  structured data without scraping ANSI-colored strings, and separately on
 *  this formatter's plain-text content. */
export function formatThemeList(result: ThemeListResult): string {
  const { rows, activeSlug, activeDetected } = result;

  if (rows.length === 0) {
    return pc.yellow("No theme packs found in the installed @takazudo/zudo-doc package.");
  }

  const slugWidth = Math.max(4, ...rows.map((r) => r.slug.length));
  const nameWidth = Math.max(4, ...rows.map((r) => r.name.length));
  const modeWidth = Math.max(4, ...rows.map((r) => r.mode.length));
  const versionWidth = Math.max(7, ...rows.map((r) => r.version.length));

  const lines: string[] = [];
  lines.push(pc.bold(`Installed theme packs (${rows.length}):`));
  lines.push("");
  lines.push(
    "  " +
      pc.dim(
        `${padEnd("SLUG", slugWidth)}  ${padEnd("NAME", nameWidth)}  ${padEnd("MODE", modeWidth)}  ${padEnd("VERSION", versionWidth)}  DESCRIPTION`,
      ),
  );

  for (const row of rows) {
    const marker = row.active ? pc.green("*") : " ";
    const activeSuffix = row.active ? pc.green("  (active)") : "";
    lines.push(
      `${marker} ${padEnd(row.slug, slugWidth)}  ${padEnd(row.name, nameWidth)}  ${padEnd(row.mode, modeWidth)}  ${padEnd(row.version, versionWidth)}  ${row.description}${activeSuffix}`,
    );
  }

  lines.push("");
  if (activeDetected) {
    lines.push(`Active theme pack: ${pc.bold(activeSlug)}`);
  } else {
    lines.push(
      pc.dim(
        `Active theme pack: ${activeSlug} (default — no zfb.config.ts "themePack" field found or readable)`,
      ),
    );
  }
  lines.push("");
  lines.push(pc.dim("Run `zudo-doc theme apply <slug>` to switch."));

  return lines.join("\n");
}
