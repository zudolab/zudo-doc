// eject-logo/eject — `zudo-doc eject logo` orchestration (issue #3050, epic
// #3047). Materializes the deterministic AutoLogo design as a standalone
// SVG at `public/img/logo.svg` and rewrites `zfb.config.ts`'s `logo` field
// to point at it.
//
// Write ordering (matches the issue's "precompute before writing"
// contract): the (pure) config rewrite is computed FIRST — so a refusal is
// known before any file is touched — then the SVG is written, then the
// config is written only if the rewrite succeeded. A rewrite refusal still
// leaves the SVG written (partial success) and exits nonzero; an SVG-exists
// refusal (without --force) leaves nothing written at all.
//
// Imports `renderAutoLogoStandaloneSvg` directly from the sibling
// `auto-logo/standalone.js` module — never the `auto-logo` package barrel,
// which pulls in preact/jsx-runtime (see that module's own header comment).
// This CLI path must stay preact-free.

import fs from "fs-extra";
import path from "node:path";

import { renderAutoLogoStandaloneSvg } from "../auto-logo/standalone.js";
import { applyLogoFieldToConfigSource } from "./config-rewriter.js";
import { resolveSiteNameFromConfigSource } from "./site-name.js";

const ZFB_CONFIG_FILENAME = "zfb.config.ts";
const LOGO_RELATIVE_PATH = path.join("public", "img", "logo.svg");
// The runtime default (config.ts's DEFAULT_SETTINGS.siteName) — used as the
// logo seed when zfb.config.ts is the canonical literal shape but declares
// no siteName field at all.
const DEFAULT_SEED = "Docs";

export interface EjectLogoOptions {
  cwd?: string;
  /** Explicit seed override (already validated non-empty by the CLI arg
   *  parser in bin/zudo-doc.mjs). When omitted, the seed is resolved from
   *  zfb.config.ts's siteName field. */
  seed?: string;
  force?: boolean;
}

export interface EjectLogoResult {
  ok: boolean;
  /** Human-readable outcome message (success confirmation, or a refusal
   *  explaining WHY). */
  message: string;
  /** True when the SVG was written but the config rewrite was refused — a
   *  nonzero-exit partial success, not a total failure. */
  partial?: boolean;
}

export async function ejectLogo(options: EjectLogoOptions = {}): Promise<EjectLogoResult> {
  const cwd = options.cwd ?? process.cwd();
  const force = options.force ?? false;

  const configPath = path.join(cwd, ZFB_CONFIG_FILENAME);
  if (!(await fs.pathExists(configPath))) {
    return {
      ok: false,
      message: `zfb.config.ts not found at ${configPath}.\nRun this command from your project root.`,
    };
  }
  const source = await fs.readFile(configPath, "utf8");

  // ── Seed resolution ──────────────────────────────────────────────────────
  let seed: string;
  if (options.seed) {
    seed = options.seed;
  } else {
    const resolution = resolveSiteNameFromConfigSource(source);
    if (resolution.kind === "unresolvable") {
      return {
        ok: false,
        message:
          `Could not determine a logo seed from zfb.config.ts: ${resolution.reason}\n` +
          `Pass --seed <name> to specify the logo seed explicitly.`,
      };
    }
    seed = resolution.kind === "literal" ? resolution.value : DEFAULT_SEED;
  }

  // ── Precompute the (pure) config rewrite BEFORE any file is touched ─────
  const rewriteResult = applyLogoFieldToConfigSource(source);

  // ── SVG write ─────────────────────────────────────────────────────────────
  const svgPath = path.join(cwd, LOGO_RELATIVE_PATH);
  if (!force && (await fs.pathExists(svgPath))) {
    return {
      ok: false,
      message: `${LOGO_RELATIVE_PATH} already exists.\nPass --force to overwrite it.`,
    };
  }

  const svg = renderAutoLogoStandaloneSvg(seed);
  await fs.ensureDir(path.dirname(svgPath));
  await fs.writeFile(svgPath, svg, "utf8");

  // ── Config rewrite ────────────────────────────────────────────────────────
  if (!rewriteResult.ok) {
    return {
      ok: false,
      partial: true,
      message: `Wrote ${LOGO_RELATIVE_PATH}, but could not update zfb.config.ts: ${rewriteResult.reason}`,
    };
  }

  if (rewriteResult.changed) {
    await fs.writeFile(configPath, rewriteResult.source, "utf8");
  }

  const verb = rewriteResult.changed ? "Ejected logo" : "Ejected logo (field already set)";
  return {
    ok: true,
    message: `${verb} → ${LOGO_RELATIVE_PATH}\nUpdated zfb.config.ts's logo field.`,
  };
}
