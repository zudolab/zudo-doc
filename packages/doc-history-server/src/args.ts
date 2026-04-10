/** Shared argument parsing utilities for CLI and server entry points */

export interface LocaleEntry {
  key: string;
  dir: string;
}

/** Safely get the next argument, or exit with an error if missing */
function requireNextArg(args: string[], index: number, flag: string): string {
  if (index >= args.length) {
    console.error(`Missing value for ${flag}`);
    process.exit(1);
  }
  return args[index];
}

/** Parse --locale value into { key, dir } */
function parseLocaleArg(val: string): LocaleEntry {
  const colonIdx = val.indexOf(":");
  if (colonIdx === -1) {
    console.error(`Invalid --locale format: ${val} (expected key:dir)`);
    process.exit(1);
  }
  return {
    key: val.slice(0, colonIdx),
    dir: val.slice(colonIdx + 1),
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
        contentDir = next();
        break;
      case "--locale":
        locales.push(parseLocaleArg(next()));
        break;
      case "--max-entries": {
        const n = Number(next());
        if (Number.isNaN(n) || n < 1) {
          console.error(`Invalid --max-entries value: ${args[i]}`);
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
