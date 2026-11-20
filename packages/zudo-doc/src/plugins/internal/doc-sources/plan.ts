// Route/output planning (stage three) and rendering with link resolution
// (stage four). The complete plan is built before any document is rendered,
// so every link resolves against the full set of mapped documents and assets
// regardless of which source or mapping owns them. Nothing here mutates the
// filesystem; reconciliation applies the result.

import fs from "node:fs";
import path from "node:path";
import type { DiscoveredFile, DiscoveryResult } from "./discover.js";
import { resolveLabel } from "./labels.js";
import { shouldEmitLocaleRoute } from "./locale-routes.js";
import type {
  DocSourcesDiagnostic,
  DocSourcesRunOptions,
  LabelRef,
  NormalizedSource,
} from "./model.js";
import { renderCodexAgent } from "./render/codex-agent.js";
import { renderCodexConfig } from "./render/codex-config.js";
import { renderCodexHooks } from "./render/codex-hooks.js";
import { renderCodexRules } from "./render/codex-rules.js";
import { escapeForMdx } from "./render/escape-for-mdx.js";
import { parseFrontmatter, renderFrontmatter, type FrontmatterValue } from "./render/frontmatter.js";
import {
  rewriteLinks,
  safeDecode,
  splitDestination,
  type LinkResolution,
} from "./render/links.js";
import {
  escapeMarkdownTableCell,
  languageForFilename,
  renderCodeFence,
  renderTableRow,
} from "./render/markdown-structure.js";
import {
  renderSkillFileStructure,
  renderSkillInterfaceMetadata,
} from "./render/skill.js";

/** Directory below `publicDir` that holds managed doc-source assets. */
export const ASSET_DIR = "doc-sources";

export class DocSourcesPlanError extends Error {
  constructor(message: string) {
    super(`docSources: ${message}`);
    this.name = "DocSourcesPlanError";
  }
}

/** Route segment for a file or directory name. */
export function routeSegment(name: string): string {
  return name
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

interface PlannedDoc {
  file: DiscoveredFile;
  source: NormalizedSource;
  /** POSIX route directory below `/docs/` that contains this page. */
  routeDir: string;
  /** POSIX output path relative to the default content directory. */
  outputRel: string;
  landing: boolean;
}

interface PlannedAsset {
  file: DiscoveredFile;
  outputAbs: string;
  url: string;
}

interface DirectoryInfo {
  source: NormalizedSource;
  label: LabelRef;
  description?: LabelRef;
  position?: number;
}

/** One file the reconciliation stage must own after this run. */
export interface PlannedOutput {
  abs: string;
  content: string | Buffer;
}

export interface Plan {
  outputs: PlannedOutput[];
  /** Absolute roots every planned or owned output must stay inside. */
  outputRoots: string[];
  diagnostics: DocSourcesDiagnostic[];
  counts: { documents: number; assets: number; indexes: number };
}

function describe(file: DiscoveredFile): string {
  return `source "${file.mapping.sourceId}" mapping "${file.mapping.id}" file "${file.rel}"`;
}

function stripExtension(name: string, extensions: string[]): string {
  const lower = name.toLowerCase();
  const ext = extensions.find((candidate) => lower.endsWith(candidate) && lower.length > candidate.length);
  return ext === undefined ? name : name.slice(0, -ext.length);
}

function joinRoute(...parts: string[]): string {
  return parts.filter((part) => part !== "").join("/");
}

export function buildPlan(
  options: DocSourcesRunOptions,
  discovery: DiscoveryResult,
): Plan {
  const diagnostics: DocSourcesDiagnostic[] = [...discovery.diagnostics];
  const sourcesById = new Map(options.sources.map((s) => [s.id, s]));
  const docs: PlannedDoc[] = [];
  const assets: PlannedAsset[] = [];
  const outputOwners = new Map<string, string>();
  const claim = (key: string, owner: string) => {
    const previous = outputOwners.get(key);
    if (previous !== undefined) {
      throw new DocSourcesPlanError(
        `route collision: ${previous} and ${owner} both resolve to "${key}". Rename one file, or change a mapping's "to" or a source's mount.`,
      );
    }
    outputOwners.set(key, owner);
  };

  const directories = new Map<string, DirectoryInfo>();
  const sectionPositions = new Map<string, number>();
  const noteDirectory = (routeDir: string, info: DirectoryInfo) => {
    const existing = directories.get(routeDir);
    if (existing === undefined) {
      directories.set(routeDir, info);
    } else if (existing.source !== info.source) {
      throw new DocSourcesPlanError(
        `route collision: sources "${existing.source.id}" and "${info.source.id}" both own "/docs/${routeDir}/"`,
      );
    }
  };

  options.sources.forEach((source, sourceIndex) => {
    noteDirectory(source.mount, {
      source,
      label: source.title,
      description: source.description,
      position: 900 + sourceIndex,
    });
    let position = 0;
    for (const mapping of source.mappings) {
      if (mapping.to === "") continue;
      const segments = mapping.to.split("/");
      segments.forEach((_, index) => {
        const routeDir = joinRoute(source.mount, ...segments.slice(0, index + 1));
        const isSection = index === segments.length - 1;
        if (!sectionPositions.has(routeDir) && isSection) sectionPositions.set(routeDir, ++position);
        const existing = directories.get(routeDir);
        if (existing === undefined || (isSection && existing.label.key === undefined && mapping.sectionLabel?.key !== undefined)) {
          directories.set(routeDir, {
            source,
            label: isSection && mapping.sectionLabel ? mapping.sectionLabel : { fallback: segments[index]! },
            description: isSection ? mapping.sectionDescription : undefined,
            position: sectionPositions.get(routeDir),
          });
        }
      });
    }
  });

  for (const file of discovery.files) {
    const source = sourcesById.get(file.mapping.sourceId)!;
    const mapping = file.mapping;
    const segments = file.rel.split("/");
    const baseName = segments.pop()!;
    const dirSegments = segments.map((segment) => {
      const slug = routeSegment(segment);
      if (slug === "") {
        throw new DocSourcesPlanError(`${describe(file)}: directory "${segment}" has no usable route segment`);
      }
      return slug;
    });
    const baseRoute = joinRoute(source.mount, mapping.to);

    if (file.kind === "asset") {
      const outputAbs = path.join(options.publicDir, ASSET_DIR, ...baseRoute.split("/"), ...file.rel.split("/"));
      claim(`asset:${path.relative(options.publicDir, outputAbs)}`, describe(file));
      // Root-relative: the markdown pipeline prefixes the site base itself.
      const url = `/${[ASSET_DIR, ...baseRoute.split("/"), ...file.rel.split("/")].map(encodeURIComponent).join("/")}`;
      assets.push({ file, outputAbs, url });
      continue;
    }

    const lowerBase = baseName.toLowerCase();
    const landing = file.kind === "document" && mapping.renderer === "skill"
      ? lowerBase === "skill.md"
      : mapping.landingNames.includes(lowerBase);
    const stem = file.kind === "skill-page"
      ? stripExtension(baseName, [".md", ".mdx"])
      : stripExtension(baseName, mapping.stripExtensions);
    let routeDir = joinRoute(baseRoute, ...dirSegments);
    let outputRel: string;
    if (file.kind === "skill-page") {
      // Skill sub-pages stay flat siblings of the skill landing page, so a
      // skill reads as one sidebar entry; nested paths join with "-".
      const skillDir = file.skillDir ?? ".";
      const skillSegments = skillDir === "." ? [] : skillDir.split("/").map(routeSegment);
      routeDir = joinRoute(baseRoute, ...skillSegments);
      const inner = skillDir === "." ? file.rel : file.rel.slice(skillDir.length + 1);
      const slug = routeSegment(stripExtension(inner, [".md", ".mdx"]).replace(/\//g, "-"));
      outputRel = joinRoute(routeDir, `${slug}.mdx`);
      claim(`doc:${outputRel}`, describe(file));
      docs.push({ file, source, routeDir, outputRel, landing: false });
      continue;
    }
    if (landing) {
      outputRel = joinRoute(routeDir, "index.mdx");
    } else {
      const slug = routeSegment(stem);
      if (slug === "") {
        throw new DocSourcesPlanError(`${describe(file)}: file name has no usable route segment`);
      }
      outputRel = joinRoute(routeDir, `${slug}.mdx`);
    }
    claim(`doc:${outputRel}`, describe(file));
    docs.push({ file, source, routeDir, outputRel, landing });

    // Every directory between the mapping subtree and this page needs a
    // landing; the source directory name is the best available label.
    segments.forEach((original, index) => {
      const dir = joinRoute(baseRoute, ...dirSegments.slice(0, index + 1));
      if (!directories.has(dir)) directories.set(dir, { source, label: { fallback: original } });
    });
  }

  // Index synthesis: only where no mapped document owns the directory route.
  const ownedDirs = new Set(docs.filter((d) => d.landing).map((d) => d.routeDir));
  const publishedDirs = new Set<string>();
  for (const doc of docs) {
    const parts = doc.routeDir.split("/");
    for (let i = 1; i <= parts.length; i++) publishedDirs.add(parts.slice(0, i).join("/"));
  }

  const lookupByPath = new Map<string, { doc?: PlannedDoc; asset?: PlannedAsset }>();
  const remember = (p: string, entry: { doc?: PlannedDoc; asset?: PlannedAsset }) => {
    if (!lookupByPath.has(p)) lookupByPath.set(p, entry);
  };
  for (const doc of docs) {
    remember(doc.file.abs, { doc });
    remember(doc.file.real, { doc });
  }
  for (const asset of assets) {
    remember(asset.file.abs, { asset });
    remember(asset.file.real, { asset });
  }

  const outputs: PlannedOutput[] = [];
  const locales = Object.entries(options.locales);
  const label = (ref: LabelRef, locale: string) =>
    resolveLabel(ref, locale, options.defaultLocale, options.translations);

  // ---- synthesized indexes (default locale + configured locales) ----------
  let indexCount = 0;
  for (const [routeDir, info] of [...directories.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (ownedDirs.has(routeDir) || !publishedDirs.has(routeDir)) continue;
    const targets: Array<[string, string]> = [[options.defaultLocale, options.docsDir]];
    for (const [locale, dir] of locales) {
      if (shouldEmitLocaleRoute(routeDir, locale, options.defaultLocale, options.defaultLocaleOnlyPrefixes)) {
        targets.push([locale, dir]);
      }
    }
    for (const [locale, contentDir] of targets) {
      const title = label(info.label, locale);
      const description = info.description ? label(info.description, locale) : undefined;
      const frontmatter = renderFrontmatter([
        ["title", title],
        ["description", description],
        ["sidebar_position", info.position],
        ["generated", true],
        ["doc_source", info.source.id],
      ]);
      outputs.push({
        abs: path.join(contentDir, ...routeDir.split("/"), "index.mdx"),
        content: `${frontmatter}\n\n<CategoryNav category=${JSON.stringify(routeDir)} />\n`,
      });
      indexCount++;
    }
  }

  // ---- documents ----------------------------------------------------------
  for (const doc of docs) {
    const { file } = doc;
    const warn = (message: string) =>
      diagnostics.push({ level: "warn", message: `${describe(file)}: ${message}` });
    let source: string;
    try {
      source = fs.readFileSync(file.abs, "utf8");
    } catch (error) {
      throw new DocSourcesPlanError(`${describe(file)}: cannot read source (${String(error)})`);
    }
    const resolve = (url: string): LinkResolution => {
      const { pathPart, query, fragment } = splitDestination(url);
      if (pathPart === "") return { kind: "keep" };
      const target = path.resolve(path.dirname(file.abs), safeDecode(pathPart));
      const candidates = [target];
      if (pathPart.endsWith("/") || !/\.[^/]+$/.test(pathPart)) {
        for (const name of ["README.md", "index.md", "index.mdx", "SKILL.md", "CLAUDE.md", "AGENTS.md"]) {
          candidates.push(path.join(target, name));
        }
      }
      for (const candidate of candidates) {
        let hit = lookupByPath.get(candidate);
        if (hit === undefined) {
          try {
            hit = lookupByPath.get(fs.realpathSync.native(candidate));
          } catch {
            hit = undefined;
          }
        }
        if (hit?.doc !== undefined) {
          let rel = path.posix.relative(path.posix.dirname(doc.outputRel), hit.doc.outputRel);
          if (!rel.startsWith(".")) rel = `./${rel}`;
          return { kind: "rewrite", url: `${rel}${query}${fragment}` };
        }
        if (hit?.asset !== undefined) {
          return { kind: "rewrite", url: `${hit.asset.url}${query}${fragment}` };
        }
      }
      return { kind: "unmapped" };
    };
    const linkify = (markdown: string): string => {
      const result = rewriteLinks(markdown, resolve);
      if (result.unmapped.length > 0) {
        warn(`unpublished link target(s) kept as text: ${[...new Set(result.unmapped)].join(", ")}`);
      }
      return result.content;
    };

    const { mapping } = file;
    const baseName = path.posix.basename(file.rel);
    let title: string;
    let description = "";
    let body: string;

    if (file.kind === "skill-page" || mapping.renderer === "markdown" || mapping.renderer === "skill") {
      const parsed = parseFrontmatter(source);
      const data = (parsed?.data ?? {}) as Record<string, unknown>;
      const content = parsed?.content ?? source;
      const fmString = (key: string) => (typeof data[key] === "string" && data[key] !== "" ? data[key] as string : undefined);
      const h1 = content.match(/^#\s+(.+?)\s*#*\s*$/m)?.[1];
      const isSkill = file.kind === "document" && mapping.renderer === "skill";
      const skillDir = path.posix.dirname(file.rel);
      const skillName = skillDir === "." ? path.basename(mapping.root) : path.posix.basename(skillDir);
      title = mapping.titleFromPath && file.kind === "document"
        ? file.rel
        : fmString("title") ?? fmString("name") ?? (isSkill ? skillName : undefined) ?? h1 ?? stripExtension(baseName, [".md", ".mdx"]);
      description = fmString("description") ?? "";
      if (isSkill && description.length > 200) description = `${description.slice(0, 200)}...`;

      const metaRows = Object.entries(data)
        .filter(([key, value]) =>
          !["title", "name", "description"].includes(key) &&
          (typeof value === "string" || typeof value === "number" || typeof value === "boolean" ||
            (Array.isArray(value) && value.every((v) => typeof v !== "object"))))
        .map(([key, value]) => renderTableRow([key, Array.isArray(value) ? value.join(", ") : value]));
      const metaTable = metaRows.length > 0
        ? ["| Field | Value |", "| --- | --- |", ...metaRows].join("\n")
        : "";

      let extra = "";
      let structure = "";
      if (isSkill) {
        const tree = discovery.skillTrees.get(`${mapping.sourceId}\u0000${mapping.id}\u0000${skillDir}`) ?? [];
        if (tree.includes("agents/openai.yaml")) {
          try {
            extra = renderSkillInterfaceMetadata(
              fs.readFileSync(path.join(path.dirname(file.abs), "agents", "openai.yaml"), "utf8"),
              skillName,
              warn,
            );
          } catch (error) {
            warn(`agents/openai.yaml: unable to read (${String(error)})`);
          }
        }
        structure = renderSkillFileStructure(skillName, tree);
      }
      const markdown = [structure, content.trim()].filter(Boolean).join("\n\n");
      body = [extra, metaTable, escapeForMdx(linkify(markdown))].filter(Boolean).join("\n\n");
    } else if (mapping.renderer === "code") {
      title = baseName;
      const firstLines = source.split("\n", 2);
      const commentLine = (firstLines[0] ?? "").startsWith("#!") ? firstLines[1] ?? "" : firstLines[0] ?? "";
      description = commentLine.match(/^(?:#|\/\/)\s*(.+)/)?.[1]?.trim() ?? "";
      body = `## Source\n\n${renderCodeFence(source, languageForFilename(baseName))}`;
    } else if (mapping.renderer === "codex-agent") {
      ({ title, description, body } = renderCodexAgent(source, stripExtension(baseName, [".toml"]), warn));
    } else if (mapping.renderer === "codex-config") {
      ({ title, description, body } = renderCodexConfig(source, baseName, warn));
    } else if (mapping.renderer === "codex-hooks") {
      ({ title, description, body } = renderCodexHooks(source, baseName, warn));
    } else {
      ({ title, description, body } = renderCodexRules(source, baseName));
    }

    const section = directories.get(doc.routeDir);
    const ownsSection = doc.landing && section !== undefined && section.position !== undefined;
    const fields: Array<[string, FrontmatterValue]> = [
      ["title", title],
      ["description", description],
      ["sidebar_label", ownsSection ? label(section.label, options.defaultLocale) : undefined],
      ["sidebar_position", ownsSection ? section.position : undefined],
      ["unlisted", file.kind === "skill-page" ? true : undefined],
      ["generated", true],
      ["doc_source", mapping.sourceId],
      ["doc_source_mapping", mapping.id],
      ["doc_source_path", file.rel],
    ];
    outputs.push({
      abs: path.join(options.docsDir, ...doc.outputRel.split("/")),
      content: `${renderFrontmatter(fields)}\n\n${body.trim()}\n`,
    });
  }

  // ---- assets -------------------------------------------------------------
  for (const asset of assets) {
    try {
      outputs.push({ abs: asset.outputAbs, content: fs.readFileSync(asset.file.abs) });
    } catch (error) {
      throw new DocSourcesPlanError(`${describe(asset.file)}: cannot read asset (${String(error)})`);
    }
  }

  const outputRoots = options.sources.flatMap((source) => [
    path.join(options.docsDir, source.mount),
    ...locales.map(([, dir]) => path.join(dir, source.mount)),
    path.join(options.publicDir, ASSET_DIR, source.mount),
  ]);

  return {
    outputs,
    outputRoots,
    diagnostics,
    counts: { documents: docs.length, assets: assets.length, indexes: indexCount },
  };
}

export { escapeMarkdownTableCell };
