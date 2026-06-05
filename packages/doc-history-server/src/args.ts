/** Shared argument parsing utilities for CLI and server entry points */

import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

export interface LocaleEntry {
  key: string;
  dir: string;
}

/**
 * Resolve a relative content/locale path to an absolute, existing directory.
 *
 * When invoked via `pnpm --filter <pkg>`, process.cwd() is the package
 * directory, not the repo root. pnpm sets INIT_CWD to the directory where pnpm
 * was originally invoked — typically the repo root — so the canonical clean
 * form "src/content/docs" resolves correctly via INIT_CWD without any "../../"
 * prefix. CI (`build-history`) and `dev:history` both pass this clean form.
 *
 * Resolution order:
 *   1. Absolute path → use as-is
 *   2. Relative + INIT_CWD set + resolves to an existing directory → use that
 *   3. Relative → fall back to process.cwd()
 *
 * The resolved path MUST be an existing directory. A non-existent path is a
 * HARD error (exit 1), not a silent fallthrough: scanning a missing dir yields
 * zero history entries while the process still exits 0, hiding a misconfigured
 * `--content-dir` behind a green CI run (the silent-empty-history class behind
 * #1907 / #1913). Failing loud turns that into a visible CI failure.
 */
export function resolveContentPath(p: string): string {
  if (isAbsolute(p)) {
    if (!existsSync(p)) {
      console.error(`doc-history-server: content path "${p}" does not exist`);
      process.exit(1);
    }
    return p;
  }
  const initCwd = process.env["INIT_CWD"];
  if (initCwd) {
    const candidate = resolve(initCwd, p);
    if (existsSync(candidate)) return candidate;
    // INIT_CWD candidate didn't exist; fall through to process.cwd() resolution
    console.warn(
      `doc-history-server: INIT_CWD candidate "${candidate}" does not exist; falling back to process.cwd()`,
    );
  }
  const fallback = resolve(p);
  if (!existsSync(fallback)) {
    console.error(
      `doc-history-server: content path "${p}" did not resolve to an existing directory ` +
        `(tried INIT_CWD=${initCwd ? `"${initCwd}"` : "(unset)"}, cwd="${process.cwd()}"). ` +
        `Pass a repo-root-relative path (pnpm sets INIT_CWD) or an absolute path.`,
    );
    process.exit(1);
  }
  return fallback;
}

/** Safely get the next argument, or exit with an error if missing */
function requireNextArg(args: string[], index: number, flag: string): string {
  if (index >= args.length) {
    console.error(`Missing value for ${flag}`);
    process.exit(1);
  }
  return args[index];
}

/** Parse --locale value into { key, dir } — dir is resolved via resolveContentPath */
function parseLocaleArg(val: string): LocaleEntry {
  const colonIdx = val.indexOf(":");
  if (colonIdx === -1) {
    console.error(`Invalid --locale format: ${val} (expected key:dir)`);
    process.exit(1);
  }
  return {
    key: val.slice(0, colonIdx),
    dir: resolveContentPath(val.slice(colonIdx + 1)),
  };
}

export interface CommonArgs {
  contentDir: string;
  locales: LocaleEntry[];
  maxEntries: number;
}

export interface ServerArgs extends CommonArgs {
  port: number;
}

export interface CliArgs extends CommonArgs {
  outDir: string;
}

/** Parse shared flags (--content-dir, --locale, --max-entries) */
export function parseCommonArgs(
  args: string[],
  extra: {
    onFlag: (flag: string, nextArg: () => string) => boolean;
  },
): CommonArgs {
  let contentDir = "";
  const locales: LocaleEntry[] = [];
  let maxEntries = 50;

  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    const next = () => requireNextArg(args, ++i, flag);

    switch (flag) {
      case "--content-dir":
        contentDir = resolveContentPath(next());
        break;
      case "--locale":
        locales.push(parseLocaleArg(next()));
        break;
      case "--max-entries": {
        const raw = next();
        const n = Number(raw);
        if (Number.isNaN(n) || n < 1) {
          console.error(`Invalid --max-entries value: ${raw}`);
          process.exit(1);
        }
        maxEntries = n;
        break;
      }
      default:
        if (flag === "--") break; // pnpm passes "--" as arg separator; skip it
        if (!extra.onFlag(flag, next)) {
          if (flag.startsWith("--")) {
            console.error(`Unknown option: ${flag}`);
            process.exit(1);
          }
        }
    }
  }

  if (!contentDir) {
    console.error("Missing required --content-dir option");
    process.exit(1);
  }

  return { contentDir, locales, maxEntries };
}

/** Parse server-specific args */
export function parseServerArgs(args: string[]): ServerArgs {
  let port = 4322;
  const common = parseCommonArgs(args, {
    onFlag: (flag, next) => {
      if (flag === "--port") {
        const n = Number(next());
        if (Number.isNaN(n) || n < 1) {
          console.error(`Invalid --port value`);
          process.exit(1);
        }
        port = n;
        return true;
      }
      return false;
    },
  });
  return { ...common, port };
}

/** Parse CLI-specific args */
export function parseCliArgs(args: string[]): CliArgs {
  let outDir = "";
  const common = parseCommonArgs(args, {
    onFlag: (flag, next) => {
      if (flag === "--out-dir") {
        outDir = next();
        return true;
      }
      return false;
    },
  });

  if (!outDir) {
    console.error("Missing required --out-dir option");
    process.exit(1);
  }

  return { ...common, outDir };
}
