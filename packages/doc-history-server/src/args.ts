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
  const value = args[index];
  if (value === undefined) {
    console.error(`Missing value for ${flag}`);
    process.exit(1);
  }
  return value;
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
  /** Network interface to bind. Defaults to "127.0.0.1" (localhost only). */
  host: string;
  /**
   * Whether the caller explicitly opted in to LAN exposure via --allow-lan-history.
   * Required when --host is a non-loopback address; the server refuses to bind
   * a non-loopback address without this flag, preventing accidental LAN exposure
   * of full git history (including unpublished content).
   */
  allowLan: boolean;
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
    if (flag === undefined) continue;
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

/**
 * Return true when `host` is a loopback address (IPv4 or IPv6).
 * Only loopback addresses are considered safe for localhost-only binding;
 * everything else requires --allow-lan-history.
 */
function isLoopback(host: string): boolean {
  return (
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "localhost"
  );
}

/** Parse server-specific args */
export function parseServerArgs(args: string[]): ServerArgs {
  let port = 4322;
  // Bind to loopback by default; pass --host 0.0.0.0 AND --allow-lan-history
  // to expose on the LAN.  The zfb dev plugin proxies /doc-history/* server-
  // side, so localhost-only is sufficient for both `pnpm dev` and
  // `pnpm dev:network`.
  let host = "127.0.0.1";
  // --allow-lan-history is a separate explicit opt-in distinct from --host so
  // that copy-pasted `--host 0.0.0.0` snippets don't silently expose full git
  // history (including unpublished draft content) on the LAN.  The server will
  // refuse to bind a non-loopback host without this flag.
  let allowLan = false;
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
      if (flag === "--host") {
        host = next();
        return true;
      }
      if (flag === "--allow-lan-history") {
        // Boolean flag — consumes no next argument.
        allowLan = true;
        return true;
      }
      return false;
    },
  });

  // Safety gate: refuse non-loopback binding without explicit opt-in.
  // This prevents `--host 0.0.0.0` (commonly copy-pasted from zfb docs) from
  // silently broadcasting the full git history, including unpublished drafts,
  // to every device on the local network.
  if (!isLoopback(host) && !allowLan) {
    console.error(
      `doc-history-server: binding to "${host}" exposes full git history on the LAN, ` +
        `including unpublished content. Pass --allow-lan-history to confirm this is intentional.`,
    );
    process.exit(1);
  }

  return { ...common, port, host, allowLan };
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
