// Configuration normalization and preset expansion: the first pipeline stage.
// Validates the data-only `docSources` setting and resolves every path to an
// absolute location. No filesystem access happens here.

import path from "node:path";
import type { NormalizedMapping, NormalizedSource } from "./model.js";
import { PRESETS } from "./presets.js";

const SEGMENT = /^[a-z0-9][a-z0-9._-]*$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const FORMATS = new Set(["markdown", "code", "skill"]);
const MISSING = new Set(["error", "skip"]);
const MARKDOWN_LANDINGS = ["index.md", "index.mdx", "readme.md"];

export class DocSourcesConfigError extends Error {
  constructor(message: string) {
    super(`docSources: ${message}`);
    this.name = "DocSourcesConfigError";
  }
}

export interface NormalizeOptions {
  projectRoot: string;
  /** Injected home-directory resolver used for explicit `~/` paths. */
  homeDir: () => string;
}

/**
 * Resolve one configured path. Relative paths resolve from the documentation
 * project root; absolute paths pass through; `~` and `~/…` expand against the
 * injected home directory. `~user` forms are rejected rather than guessed.
 */
export function resolveConfiguredPath(
  input: string,
  { projectRoot, homeDir }: NormalizeOptions,
  label: string,
): string {
  if (input === "~" || input.startsWith("~/")) {
    return path.resolve(homeDir(), input.slice(2));
  }
  if (input.startsWith("~")) {
    throw new DocSourcesConfigError(
      `${label}: "${input}" uses an unsupported home-directory form; use "~/…" or an absolute path`,
    );
  }
  return path.isAbsolute(input) ? path.normalize(input) : path.resolve(projectRoot, input);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertKeys(value: Record<string, unknown>, allowed: string[], label: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new DocSourcesConfigError(
        `${label}: unknown field "${key}" (allowed: ${allowed.join(", ")})`,
      );
    }
  }
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DocSourcesConfigError(`${label} must be a non-empty string`);
  }
  return value;
}

function optionalString(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : requireString(value, label);
}

function stringList(value: unknown, label: string, required: boolean): string[] {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value) || (required && value.length === 0) ||
    !value.every((item) => typeof item === "string" && item.length > 0)) {
    throw new DocSourcesConfigError(
      `${label} must be ${required ? "a non-empty" : "an"} array of glob strings`,
    );
  }
  for (const pattern of value as string[]) {
    if (pattern.startsWith("/") || pattern.split("/").includes("..")) {
      throw new DocSourcesConfigError(
        `${label}: pattern "${pattern}" must stay relative to the mapping root`,
      );
    }
  }
  return value as string[];
}

function validateId(value: unknown, label: string): string {
  const id = requireString(value, label);
  if (!ID.test(id)) {
    throw new DocSourcesConfigError(
      `${label} "${id}" must contain only letters, digits, "-" and "_"`,
    );
  }
  return id;
}

function validateMount(value: string, label: string): string {
  if (!SEGMENT.test(value)) {
    throw new DocSourcesConfigError(
      `${label} "${value}" must be one lower-case route segment (a-z, 0-9, ".", "_", "-")`,
    );
  }
  return value;
}

function validateTo(value: unknown, label: string): string {
  if (value === undefined || value === "") return "";
  const to = requireString(value, label).replace(/^\/+|\/+$/g, "");
  for (const segment of to.split("/")) {
    if (!SEGMENT.test(segment)) {
      throw new DocSourcesConfigError(
        `${label} "${String(value)}" must be a relative route path of lower-case segments`,
      );
    }
  }
  return to;
}

function normalizeMapping(
  sourceId: string,
  raw: unknown,
  index: number,
  options: NormalizeOptions,
): NormalizedMapping {
  const label = `source "${sourceId}" mappings[${index}]`;
  if (!isRecord(raw)) throw new DocSourcesConfigError(`${label} must be an object`);
  assertKeys(raw, ["id", "root", "include", "exclude", "to", "format", "missing", "assets"], label);
  const id = validateId(raw.id, `${label}.id`);
  const format = requireString(raw.format, `${label}.format`);
  if (!FORMATS.has(format)) {
    throw new DocSourcesConfigError(`${label}.format must be "markdown", "code" or "skill"`);
  }
  const missing = raw.missing === undefined ? "error" : requireString(raw.missing, `${label}.missing`);
  if (!MISSING.has(missing)) {
    throw new DocSourcesConfigError(`${label}.missing must be "error" or "skip"`);
  }
  let assets: NormalizedMapping["assets"];
  if (raw.assets !== undefined) {
    if (!isRecord(raw.assets)) throw new DocSourcesConfigError(`${label}.assets must be an object`);
    assertKeys(raw.assets, ["include", "exclude"], `${label}.assets`);
    assets = {
      include: stringList(raw.assets.include, `${label}.assets.include`, true),
      exclude: stringList(raw.assets.exclude, `${label}.assets.exclude`, false),
    };
  }
  const to = validateTo(raw.to, `${label}.to`);
  const lastSegment = to.split("/").at(-1) ?? "";
  return {
    sourceId,
    id,
    root: resolveConfiguredPath(requireString(raw.root, `${label}.root`), options, `${label}.root`),
    include: stringList(raw.include, `${label}.include`, true),
    exclude: stringList(raw.exclude, `${label}.exclude`, false),
    to,
    renderer: format as NormalizedMapping["renderer"],
    missing: missing as NormalizedMapping["missing"],
    assets,
    landingNames: format === "code" ? [] : MARKDOWN_LANDINGS,
    stripExtensions: format === "code" ? [] : [".md", ".mdx"],
    titleFromPath: false,
    sectionLabel: to === "" ? undefined : { fallback: lastSegment },
  };
}

/**
 * Normalize the `docSources` setting. Returns an empty list for `undefined`
 * or `[]`; the caller still runs reconciliation so stale output is removed.
 */
export function normalizeDocSources(
  raw: unknown,
  options: NormalizeOptions,
): NormalizedSource[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new DocSourcesConfigError("the setting must be an array");

  const sources: NormalizedSource[] = [];
  const ids = new Set<string>();
  const mounts = new Map<string, string>();

  raw.forEach((entry, index) => {
    const label = `docSources[${index}]`;
    if (!isRecord(entry)) throw new DocSourcesConfigError(`${label} must be an object`);
    const id = validateId(entry.id, `${label}.id`);
    if (ids.has(id)) throw new DocSourcesConfigError(`duplicate source id "${id}"`);
    ids.add(id);
    const mount = validateMount(
      optionalString(entry.mount, `${label}.mount`) ?? id,
      entry.mount === undefined ? `${label}.id (default mount)` : `${label}.mount`,
    );
    const previous = mounts.get(mount);
    if (previous !== undefined) {
      throw new DocSourcesConfigError(
        `sources "${previous}" and "${id}" both mount at "/docs/${mount}/"; give one a distinct mount`,
      );
    }
    mounts.set(mount, id);

    if ("preset" in entry) {
      assertKeys(entry, ["id", "preset", "root", "scanRoot", "mount"], label);
      const presetName = requireString(entry.preset, `${label}.preset`);
      const expand = PRESETS[presetName];
      if (expand === undefined) {
        throw new DocSourcesConfigError(
          `${label}.preset "${presetName}" is unknown (available: ${Object.keys(PRESETS).join(", ")}); use custom mappings for other layouts`,
        );
      }
      const root = resolveConfiguredPath(requireString(entry.root, `${label}.root`), options, `${label}.root`);
      const scanRootInput = optionalString(entry.scanRoot, `${label}.scanRoot`);
      const scanRoot = scanRootInput === undefined
        ? path.resolve(options.projectRoot)
        : resolveConfiguredPath(scanRootInput, options, `${label}.scanRoot`);
      sources.push(expand({ id, mount, root, scanRoot }));
      return;
    }

    assertKeys(entry, ["id", "title", "mount", "mappings"], label);
    const title = requireString(entry.title, `${label}.title`);
    if (!Array.isArray(entry.mappings) || entry.mappings.length === 0) {
      throw new DocSourcesConfigError(`${label}.mappings must be a non-empty array`);
    }
    const mappings = entry.mappings.map((mappingRaw, mappingIndex) =>
      normalizeMapping(id, mappingRaw, mappingIndex, options),
    );
    const mappingIds = new Set<string>();
    for (const m of mappings) {
      if (mappingIds.has(m.id)) {
        throw new DocSourcesConfigError(`source "${id}" has duplicate mapping id "${m.id}"`);
      }
      mappingIds.add(m.id);
    }
    sources.push({ id, mount, title: { fallback: title }, requiredRoots: [], mappings });
  });

  return sources;
}
