import { pathToFileURL } from "node:url";
import { isAbsolute, resolve } from "node:path";

import type { TagCliConfig } from "@takazudo/zudo-doc/tags-audit";

const GOVERNANCE_MODES = new Set(["off", "warn", "strict"]);

function invalidConfig(configPath: string, detail: string): Error {
  return new Error(`Invalid tag CLI config "${configPath}": ${detail}`);
}

function validateConfig(value: unknown, configPath: string): TagCliConfig {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw invalidConfig(configPath, "the module must default-export an object");
  }

  const config = value as Record<string, unknown>;
  if (
    !Array.isArray(config.contentDirs) ||
    config.contentDirs.length === 0 ||
    config.contentDirs.some(
      (dir) =>
        typeof dir !== "string" ||
        dir.trim().length === 0 ||
        isAbsolute(dir),
    )
  ) {
    throw invalidConfig(
      configPath,
      "`contentDirs` must be a non-empty array of project-relative paths",
    );
  }
  if (
    !Array.isArray(config.vocabulary) ||
    config.vocabulary.some(
      (entry) =>
        entry === null ||
        typeof entry !== "object" ||
        typeof (entry as { id?: unknown }).id !== "string" ||
        (entry as { id: string }).id.trim().length === 0,
    )
  ) {
    throw invalidConfig(
      configPath,
      "`vocabulary` must be an array of entries with non-empty string ids",
    );
  }
  if (
    typeof config.governance !== "string" ||
    !GOVERNANCE_MODES.has(config.governance)
  ) {
    throw invalidConfig(
      configPath,
      "`governance` must be one of \"off\", \"warn\", or \"strict\"",
    );
  }
  if (typeof config.vocabularyActive !== "boolean") {
    throw invalidConfig(configPath, "`vocabularyActive` must be a boolean");
  }

  return config as unknown as TagCliConfig;
}

export async function loadTagCliConfig(
  configInput: string | undefined,
  cwd = process.cwd(),
): Promise<{ config: TagCliConfig; configPath: string }> {
  if (!configInput || configInput.trim().length === 0) {
    throw new Error(
      "Missing required tag CLI config. Pass `--config <path>` to a module that default-exports TagCliConfig.",
    );
  }

  const configPath = isAbsolute(configInput)
    ? resolve(configInput)
    : resolve(cwd, configInput);

  let loaded: { default?: unknown };
  try {
    loaded = (await import(pathToFileURL(configPath).href)) as {
      default?: unknown;
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not load tag CLI config "${configPath}": ${detail}`);
  }

  return {
    config: validateConfig(loaded.default, configPath),
    configPath,
  };
}

/** Package-manager `--` separators must not hide CLI options from the runner. */
export function withoutForwardingSeparators(argv: string[]): string[] {
  return argv.filter((arg) => arg !== "--");
}

export function takeTagCliConfigInput(argv: string[]): {
  configInput: string | undefined;
  argv: string[];
} {
  const normalized = withoutForwardingSeparators(argv);
  const rest: string[] = [];
  let configInput: string | undefined;

  for (let index = 0; index < normalized.length; index++) {
    const arg = normalized[index]!;
    if (arg === "--config" || arg === "-c") {
      const value = normalized[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error(`Option \`${arg}\` requires a path.`);
      }
      configInput = value;
      index++;
      continue;
    }
    if (arg.startsWith("--config=")) {
      configInput = arg.slice("--config=".length);
      continue;
    }
    rest.push(arg);
  }

  return { configInput, argv: rest };
}
