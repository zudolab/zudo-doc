// theme-cli/apply — `zudo-doc theme apply <slug>` orchestration: validates
// the slug against the installed catalog, rewrites `zfb.config.ts` via the
// pure `config-rewriter`, and records `.zudo-doc.json` provenance (ADR
// docs/adr/theme-packs.md "`theme apply <slug>`").
//
// This module owns the ONLY filesystem writes in the theme CLI. It never
// writes anything when the rewrite is refused (`config-rewriter.ts` never
// returns a `source` alongside a refusal) or when the slug is unknown.

import fs from "fs-extra";

import { applyThemePackToConfigSource } from "./config-rewriter.js";
import { resolveZfbConfigPath } from "./config-io.js";
import { writeThemePackProvenance } from "./provenance.js";
import {
  loadInstalledThemePackCatalog,
  type LoadInstalledThemePackCatalogOptions,
} from "./registry.js";

export interface ApplyThemePackOptions extends LoadInstalledThemePackCatalogOptions {
  cwd?: string;
  /** Injectable clock for tests — defaults to `() => new Date()`. */
  now?: () => Date;
}

export interface ApplyThemePackResult {
  ok: boolean;
  /** Human-readable outcome message (success confirmation, or a refusal
   *  explaining WHY + the manual one-liner to add by hand). */
  message: string;
  /** Whether zfb.config.ts's bytes actually changed (false = idempotent
   *  re-apply of the slug already configured). Only meaningful when `ok`. */
  changed?: boolean;
}

export async function applyThemePack(
  slug: string,
  options: ApplyThemePackOptions = {},
): Promise<ApplyThemePackResult> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? (() => new Date());

  let catalog;
  try {
    catalog = loadInstalledThemePackCatalog(options);
  } catch (err) {
    return {
      ok: false,
      message: `Could not load the installed theme pack catalog: ${(err as Error).message}`,
    };
  }

  const entry = catalog.find((e) => e.slug === slug);
  if (!entry) {
    const available = catalog
      .map((e) => e.slug)
      .sort()
      .join(", ");
    return {
      ok: false,
      message: `Unknown theme pack "${slug}".\nAvailable theme packs: ${available}`,
    };
  }

  const configPath = resolveZfbConfigPath(cwd);
  if (!(await fs.pathExists(configPath))) {
    return {
      ok: false,
      message: `zfb.config.ts not found at ${configPath}.\nRun this command from your project root.`,
    };
  }

  const source = await fs.readFile(configPath, "utf8");
  const result = applyThemePackToConfigSource(source, slug);

  if (!result.ok) {
    return { ok: false, message: `Refusing to modify zfb.config.ts: ${result.reason}` };
  }

  if (result.changed) {
    await fs.writeFile(configPath, result.source, "utf8");
  }

  // Written on every successful apply, even a no-op re-apply — see
  // provenance.ts's header comment.
  await writeThemePackProvenance(cwd, {
    schemaVersion: 1,
    slug,
    packVersion: entry.meta.version,
    appliedAt: now().toISOString(),
  });

  const verb = result.changed ? "Applied" : "Already applied";
  return {
    ok: true,
    changed: result.changed,
    message:
      `${verb} theme pack "${slug}" (${entry.meta.name}) to ${configPath}.\n` +
      `Provenance recorded in .zudo-doc.json.`,
  };
}
