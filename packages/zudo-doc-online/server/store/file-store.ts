/**
 * The project store — the seam between the HTTP layer and the filesystem.
 *
 * Everything `node:fs` in this server lives here and in `tx.ts`. The routes
 * only ever see the interface at the bottom of this file, so the same handlers
 * can later run against a non-Node store (epic #3327 plans a Workers port).
 *
 * On-disk layout, one directory per project:
 *
 *   data/<project-slug>/
 *     project.json          {schemaVersion, title, revision}
 *     outline.json          the core OutlineDoc — structure, order, slugs
 *     pages/<pageId>.md     YAML frontmatter {title, description?, draft?} + body
 *     trash/<timestamp>/    removed page files; nothing is ever hard-deleted
 *     .tx-staging/          in-flight commit (see tx.ts)
 *
 * The split is the title-ownership contract (epic #3327, contract 1) made
 * physical: structure, order and slugs exist ONLY in `outline.json`; a page's
 * title, description and draft flag exist ONLY in its frontmatter. Neither
 * file can contradict the other because neither stores the other's fields.
 */

import { lstat, mkdir, readdir, readFile, rename } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import {
  applyCommand,
  deriveUniqueSlug,
  findPageOwner,
  isValidSlug,
  normalizeDoc,
  validateOutlineDoc,
  type CreatedPageMeta,
  type IdFactory,
  type OutlineCommand,
  type OutlineDoc,
  type OutlineErrorCode,
} from "../../src/core/outline/index";
import {
  AURORA_PROJECT_TITLE,
  auroraDocsOutline,
  auroraDocsPages,
} from "../../src/sample/aurora-docs";
import {
  pageFrontmatterSchema,
  parsePageFile,
  serializePageFile,
  type PageFrontmatter,
} from "./frontmatter";
import { KeyedMutex } from "./locks";
import { PROJECT_FILE, recoverStagedCommit, Transaction } from "./tx";

export const PROJECT_SCHEMA_VERSION = 1;

export const OUTLINE_FILE = "outline.json";
export const PAGES_DIR = "pages";
export const TRASH_DIR = "trash";
export const PAGE_EXTENSION = ".md";

/**
 * A page id is also a filename stem, so it is restricted further than the
 * outline core requires (the core accepts any non-empty string, because an
 * importer may adopt ids the core never mints). No dots, which is what makes
 * `..` unrepresentable rather than merely filtered.
 */
const SAFE_PAGE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

/**
 * Mutex key guarding slug allocation. Deriving a free slug and claiming it must
 * be one step, or two same-titled creations both resolve to the same slug and
 * the second overwrites the first. A slug can never contain ":", so this key
 * cannot collide with a project's own lock.
 */
const CREATE_LOCK = "::create";

const projectFileSchema = z
  .object({
    schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
    title: z.string().min(1),
    revision: z.number().int().nonnegative(),
  })
  .strict();

type ProjectFile = z.infer<typeof projectFileSchema>;

export interface ProjectSummary {
  slug: string;
  title: string;
  revision: number;
}

/** A page as the composed snapshot presents it: structure plus frontmatter. */
export interface PageSummary {
  id: string;
  slug: string;
  categoryId: string;
  title: string;
  description?: string;
  draft?: boolean;
}

export interface ProjectSnapshot {
  slug: string;
  title: string;
  revision: number;
  outline: OutlineDoc;
  pages: PageSummary[];
}

export interface PageDocument {
  id: string;
  slug: string;
  categoryId: string;
  revision: number;
  frontmatter: PageFrontmatter;
  markdown: string;
}

export interface OutlineCommandInput {
  expectedRevision: number;
  command: OutlineCommand;
}

export interface OutlineCommandOutcome {
  snapshot: ProjectSnapshot;
  changed: boolean;
  selectedId: string | null;
  createdPage?: CreatedPageMeta;
}

export interface PageWriteInput {
  expectedRevision: number;
  frontmatter?: PageFrontmatter;
  markdown?: string;
}

export interface PageWriteOutcome {
  page: PageDocument;
  changed: boolean;
}

export type StoreErrorCode =
  | OutlineErrorCode
  | "project-not-found"
  | "page-not-found"
  | "revision-mismatch"
  | "invalid-request"
  | "unsafe-path"
  | "corrupt-file";

/**
 * Every failure the store can produce, carrying the HTTP status it deserves.
 * The status lives here rather than in the routes so the MCP surface (#3333),
 * which does not speak HTTP, still gets one classification of each failure.
 */
export class StoreError extends Error {
  constructor(
    readonly code: StoreErrorCode,
    message: string,
    readonly status: number,
    /** Present on `revision-mismatch` only — the state the loser must rebase on. */
    readonly snapshot?: ProjectSnapshot,
  ) {
    super(message);
    this.name = "StoreError";
  }
}

/**
 * Command failures mapped to HTTP. 409 is deliberately absent: it is reserved
 * for `revision-mismatch`, so a client can treat "409" as "refetch and rebase"
 * without inspecting the code. A conflicting slug is a rejected request, not a
 * concurrency loss, hence 422.
 */
const COMMAND_STATUS: Record<OutlineErrorCode, number> = {
  "category-not-found": 404,
  "page-not-found": 404,
  "invalid-title": 400,
  "invalid-page-id": 400,
  "page-id-conflict": 422,
  "slug-empty": 400,
  "slug-too-long": 400,
  "slug-not-normalized": 400,
  "slug-not-lowercase": 400,
  "slug-invalid-characters": 400,
  "slug-conflict": 422,
  "index-out-of-range": 422,
  "invalid-page-order": 422,
  "invalid-doc": 422,
  "id-generation-failed": 422,
  "unknown-command": 400,
};

export interface ProjectStore {
  listProjects(): Promise<ProjectSummary[]>;
  createProject(title: string): Promise<ProjectSnapshot>;
  readSnapshot(slug: string): Promise<ProjectSnapshot>;
  applyOutlineCommand(
    slug: string,
    input: OutlineCommandInput,
  ): Promise<OutlineCommandOutcome>;
  readPage(slug: string, pageId: string): Promise<PageDocument>;
  writePage(
    slug: string,
    pageId: string,
    input: PageWriteInput,
  ): Promise<PageWriteOutcome>;
}

export interface FileStoreOptions {
  dataDir: string;
  /** Injectable so seeded fixtures and tests get deterministic ids. */
  createId?: IdFactory;
  /** Injectable so trash directory names are deterministic in tests. */
  now?: () => Date;
}

export class FileProjectStore implements ProjectStore {
  private readonly dataDir: string;
  private readonly createId: IdFactory | undefined;
  private readonly now: () => Date;
  private readonly locks = new KeyedMutex();

  constructor(options: FileStoreOptions) {
    this.dataDir = path.resolve(options.dataDir);
    this.createId = options.createId;
    this.now = options.now ?? (() => new Date());
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const slugs = await this.projectSlugs();
    const summaries: ProjectSummary[] = [];
    for (const slug of slugs) {
      const project = await this.locks.run(slug, () =>
        this.readProjectFile(slug),
      );
      // A directory with no project.json is not a project — a rolled-back
      // creation leaves exactly that, and it must not fail the listing.
      if (project) summaries.push({ slug, title: project.title, revision: project.revision });
    }
    return summaries.sort((a, b) => a.slug.localeCompare(b.slug));
  }

  async createProject(title: string): Promise<ProjectSnapshot> {
    const trimmed = typeof title === "string" ? title.trim() : "";
    if (trimmed.length === 0) {
      throw new StoreError("invalid-request", "A project needs a title.", 400);
    }

    return this.locks.run(CREATE_LOCK, async () => {
      const slug = deriveUniqueSlug(trimmed, await this.projectSlugs());
      const categoryId = this.mintId("category");
      const pageId = this.mintId("page");

      const outline: OutlineDoc = {
        schemaVersion: 1,
        projectTitle: trimmed,
        categories: [
          {
            id: categoryId,
            slug: "getting-started",
            title: "Getting started",
            pages: [{ id: pageId, slug: "index" }],
          },
        ],
      };

      // The project's own lock as well: a concurrent read of this slug would
      // otherwise run recovery and clear the staging directory mid-commit.
      return this.locks.run(slug, async () => {
        const dir = this.projectDir(slug);
        await mkdir(path.join(dir, PAGES_DIR), { recursive: true });

        const tx = new Transaction(dir, 0, 1);
        tx.write(OUTLINE_FILE, toJson(outline));
        tx.write(
          pageRelPath(pageId),
          serializePageFile(
            { title: "Introduction" },
            "Write the first page of this documentation base here.\n",
          ),
        );
        tx.write(PROJECT_FILE, toJson(projectFileFor(trimmed, 1)));
        await tx.commit();

        return this.compose(slug, { schemaVersion: 1, title: trimmed, revision: 1 }, outline);
      });
    });
  }

  async readSnapshot(slug: string): Promise<ProjectSnapshot> {
    return this.withProject(slug, async ({ project, outline }) =>
      this.compose(slug, project, outline),
    );
  }

  async applyOutlineCommand(
    slug: string,
    input: OutlineCommandInput,
  ): Promise<OutlineCommandOutcome> {
    return this.withProject(slug, async ({ dir, project, outline }) => {
      await this.assertRevision(slug, project, outline, input.expectedRevision);
      assertFileSafeCommand(input.command);

      const result = applyCommand(outline, input.command, {
        ...(this.createId ? { createId: this.createId } : {}),
      });
      if (!result.ok) {
        throw new StoreError(result.code, result.message, COMMAND_STATUS[result.code]);
      }

      // A no-op must leave the revision alone: bumping it would invalidate
      // every other client's `expectedRevision` for a change that never was.
      if (!result.changed) {
        return {
          snapshot: await this.compose(slug, project, outline),
          changed: false,
          selectedId: result.selectedId,
        };
      }

      const nextRevision = project.revision + 1;
      const tx = new Transaction(dir, project.revision, nextRevision);
      tx.write(OUTLINE_FILE, toJson(result.doc));
      await this.stagePageFileLifecycle(dir, tx, input.command, outline, result.doc, result.meta?.createdPage);
      tx.write(PROJECT_FILE, toJson(projectFileFor(result.doc.projectTitle, nextRevision)));
      await tx.commit();

      const nextProject = projectFileFor(result.doc.projectTitle, nextRevision);
      return {
        snapshot: await this.compose(slug, nextProject, result.doc),
        changed: true,
        selectedId: result.selectedId,
        ...(result.meta?.createdPage ? { createdPage: result.meta.createdPage } : {}),
      };
    });
  }

  async readPage(slug: string, pageId: string): Promise<PageDocument> {
    return this.withProject(slug, async ({ dir, project, outline }) => {
      const placement = locatePage(outline, pageId);
      if (!placement) {
        throw new StoreError("page-not-found", `No page with id "${pageId}".`, 404);
      }
      const stored = await this.readPageFile(dir, pageId);
      return {
        id: pageId,
        slug: placement.slug,
        categoryId: placement.categoryId,
        revision: project.revision,
        frontmatter: stored?.frontmatter ?? { title: placement.slug },
        markdown: stored?.markdown ?? "",
      };
    });
  }

  async writePage(
    slug: string,
    pageId: string,
    input: PageWriteInput,
  ): Promise<PageWriteOutcome> {
    return this.withProject(slug, async ({ dir, project, outline }) => {
      await this.assertRevision(slug, project, outline, input.expectedRevision);

      const placement = locatePage(outline, pageId);
      if (!placement) {
        throw new StoreError("page-not-found", `No page with id "${pageId}".`, 404);
      }

      const stored = await this.readPageFile(dir, pageId);
      const frontmatter =
        input.frontmatter ?? stored?.frontmatter ?? { title: placement.slug };
      const markdown = input.markdown ?? stored?.markdown ?? "";

      // Both fields omitted means "leave everything alone". Falling through to
      // the byte comparison would rewrite a hand-formatted file into canonical
      // form and burn a revision for content the caller never sent.
      if (input.frontmatter === undefined && input.markdown === undefined) {
        return {
          page: {
            id: pageId,
            slug: placement.slug,
            categoryId: placement.categoryId,
            revision: project.revision,
            frontmatter,
            markdown,
          },
          changed: false,
        };
      }

      const parsedFrontmatter = pageFrontmatterSchema.safeParse(frontmatter);
      if (!parsedFrontmatter.success) {
        throw new StoreError(
          "invalid-request",
          `Invalid frontmatter: ${parsedFrontmatter.error.issues[0]?.message ?? "unknown problem"}.`,
          400,
        );
      }

      const contents = serializePageFile(parsedFrontmatter.data, markdown);
      const current = await this.readTextFile(path.join(dir, pageRelPath(pageId)));
      // Byte equality is the change test: an editor that autosaves an
      // unmodified buffer must not burn a revision every few seconds.
      if (current === contents) {
        const reparsed = parsePageFile(contents);
        return {
          page: {
            id: pageId,
            slug: placement.slug,
            categoryId: placement.categoryId,
            revision: project.revision,
            frontmatter: parsedFrontmatter.data,
            markdown: reparsed.ok ? reparsed.value.markdown : markdown,
          },
          changed: false,
        };
      }

      const nextRevision = project.revision + 1;
      const tx = new Transaction(dir, project.revision, nextRevision);
      tx.write(pageRelPath(pageId), contents);
      tx.write(PROJECT_FILE, toJson(projectFileFor(project.title, nextRevision)));
      await tx.commit();

      const reparsed = parsePageFile(contents);
      return {
        page: {
          id: pageId,
          slug: placement.slug,
          categoryId: placement.categoryId,
          revision: nextRevision,
          frontmatter: parsedFrontmatter.data,
          markdown: reparsed.ok ? reparsed.value.markdown : markdown,
        },
        changed: true,
      };
    });
  }

  /**
   * Creates the "Aurora Docs" sample project when `data/` holds no projects
   * yet, so a fresh checkout has something real to open. Returns the slug it
   * created, or null when the store was already populated.
   *
   * "Populated" is measured with `listProjects()`, NOT by counting directories:
   * a creation that `recover()` rolled back leaves a directory with no
   * `project.json`, which is not a project and which `listProjects()` already
   * ignores. Counting raw directories would let that orphan pass as the whole
   * store, skipping the seed and leaving the SPA to 404 on the sample project
   * it opens by default.
   */
  async seedIfEmpty(): Promise<string | null> {
    return this.locks.run(CREATE_LOCK, async () => {
      // A corrupt `project.json` makes `listProjects()` throw. That is still a
      // populated store — seeding over it would be wrong — and reporting the
      // corruption is a read's job, not boot's, so it counts as non-empty.
      const existing = await this.listProjects().catch(() => null);
      if (existing === null || existing.length > 0) return null;

      const slug = deriveUniqueSlug(AURORA_PROJECT_TITLE, []);
      return this.locks.run(slug, async () => {
        const dir = this.projectDir(slug);
        await mkdir(path.join(dir, PAGES_DIR), { recursive: true });

        const tx = new Transaction(dir, 0, 1);
        tx.write(OUTLINE_FILE, toJson(auroraDocsOutline));
        for (const page of auroraDocsPages) {
          tx.write(
            pageRelPath(page.id),
            serializePageFile(frontmatterFromMeta(page.meta), page.markdown),
          );
        }
        tx.write(PROJECT_FILE, toJson(projectFileFor(AURORA_PROJECT_TITLE, 1)));
        await tx.commit();

        return slug;
      });
    });
  }

  /**
   * Resolves any interrupted commit left by a previous process. Called once at
   * boot; every individual project access repeats the check under its own lock,
   * so a project that is opened before this finishes is still safe.
   */
  async recover(): Promise<Map<string, string>> {
    const outcomes = new Map<string, string>();
    for (const slug of await this.projectSlugs()) {
      const outcome = await this.locks.run(slug, () =>
        recoverStagedCommit(this.projectDir(slug)),
      );
      if (outcome !== "none") outcomes.set(slug, outcome);
    }
    return outcomes;
  }

  // ---------------------------------------------------------------- internals

  /**
   * The single entry point for touching a project: takes the project's lock,
   * heals any interrupted commit, then hands the caller a consistent read of
   * `project.json` and `outline.json`.
   */
  private async withProject<T>(
    slug: string,
    task: (context: {
      dir: string;
      project: ProjectFile;
      outline: OutlineDoc;
    }) => Promise<T>,
  ): Promise<T> {
    assertProjectSlug(slug);
    return this.locks.run(slug, async () => {
      const dir = this.projectDir(slug);
      await recoverStagedCommit(dir);

      const project = await this.readProjectFile(slug);
      if (!project) {
        throw new StoreError("project-not-found", `No project "${slug}".`, 404);
      }
      const outline = await this.readOutlineFile(dir);
      return task({ dir, project, outline });
    });
  }

  /**
   * The concurrency gate (epic #3327, contract 2). The snapshot is composed
   * inside the project's lock so the losing client is handed the exact state
   * that beat it — a snapshot read after the lock released could already be a
   * revision further along, and the client would rebase onto a moving target.
   */
  private async assertRevision(
    slug: string,
    project: ProjectFile,
    outline: OutlineDoc,
    expected: number,
  ): Promise<void> {
    if (project.revision === expected) return;
    throw new StoreError(
      "revision-mismatch",
      `Project is at revision ${project.revision}, but the request expected ${expected}.`,
      409,
      await this.compose(slug, project, outline),
    );
  }

  private projectDir(slug: string): string {
    return path.join(this.dataDir, slug);
  }

  /** Directory entries that could be projects: real directories, valid slugs. */
  private async projectSlugs(): Promise<string[]> {
    let entries;
    try {
      entries = await readdir(this.dataDir, { withFileTypes: true });
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
    return entries
      .filter((entry) => entry.isDirectory() && isValidSlug(entry.name))
      .map((entry) => entry.name);
  }

  private async readProjectFile(slug: string): Promise<ProjectFile | null> {
    const filePath = path.join(this.projectDir(slug), PROJECT_FILE);
    const raw = await this.readTextFile(filePath);
    if (raw === null) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw await this.quarantine(filePath, "not valid JSON");
    }
    const result = projectFileSchema.safeParse(parsed);
    if (!result.success) {
      throw await this.quarantine(
        filePath,
        result.error.issues[0]?.message ?? "does not match the project schema",
      );
    }
    return result.data;
  }

  private async readOutlineFile(dir: string): Promise<OutlineDoc> {
    const filePath = path.join(dir, OUTLINE_FILE);
    const raw = await this.readTextFile(filePath);
    if (raw === null) {
      // Absent is not malformed, so there is nothing to move aside — but a
      // project.json without its outline is still unusable.
      throw new StoreError(
        "corrupt-file",
        `${OUTLINE_FILE} is missing from project "${path.basename(dir)}".`,
        500,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw await this.quarantine(filePath, "not valid JSON");
    }
    // The outline's rules live in the core, not in a second zod schema here —
    // two definitions of "a valid outline" would eventually disagree.
    const problem = validateOutlineDoc(parsed);
    if (problem !== null) {
      throw await this.quarantine(filePath, problem);
    }
    return normalizeDoc(parsed as OutlineDoc);
  }

  /** Null when the page has no file yet; throws when the file is malformed. */
  private async readPageFile(
    dir: string,
    pageId: string,
  ): Promise<{ frontmatter: PageFrontmatter; markdown: string } | null> {
    const filePath = path.join(dir, pageRelPath(pageId));
    const raw = await this.readTextFile(filePath);
    if (raw === null) return null;

    const parsed = parsePageFile(raw);
    if (!parsed.ok) {
      throw await this.quarantine(filePath, parsed.problem);
    }
    return parsed.value;
  }

  /**
   * Reads a file, refusing to follow a symlink. Path names are already
   * restricted to an identifier charset, so a symlink planted by hand is the
   * only remaining way out of the project directory.
   */
  private async readTextFile(filePath: string): Promise<string | null> {
    assertInside(this.dataDir, filePath);
    let stats;
    try {
      stats = await lstat(filePath);
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
    if (stats.isSymbolicLink()) {
      throw new StoreError(
        "unsafe-path",
        `Refusing to read "${path.basename(filePath)}": it is a symbolic link.`,
        400,
      );
    }
    if (!stats.isFile()) return null;
    return readFile(filePath, "utf8");
  }

  /**
   * Renames a malformed file aside instead of repairing or replacing it. The
   * content is very likely hand-written and always irreplaceable; the request
   * fails loudly and the author keeps their bytes.
   */
  private async quarantine(filePath: string, problem: string): Promise<StoreError> {
    const stamp = timestampSlug(this.now());
    const target = `${filePath}.corrupt-${stamp}`;
    await rename(filePath, target).catch((error: unknown) => {
      if (!isMissing(error)) throw error;
    });
    return new StoreError(
      "corrupt-file",
      `${path.basename(filePath)} ${problem}; it was moved aside as ${path.basename(target)}.`,
      500,
    );
  }

  /**
   * Composes the snapshot the API returns: outline order, with each page's
   * frontmatter folded in. A page whose file is missing falls back to its slug
   * as the title rather than failing the read — the same rule `replace-doc`
   * uses when it stubs a file, so the two never disagree.
   */
  private async compose(
    slug: string,
    project: ProjectFile,
    outline: OutlineDoc,
  ): Promise<ProjectSnapshot> {
    const dir = this.projectDir(slug);
    const pages: PageSummary[] = [];

    for (const category of outline.categories) {
      for (const page of category.pages) {
        const stored = await this.readPageFile(dir, page.id);
        const frontmatter = stored?.frontmatter ?? { title: page.slug };
        pages.push({
          id: page.id,
          slug: page.slug,
          categoryId: category.id,
          title: frontmatter.title,
          ...(frontmatter.description !== undefined
            ? { description: frontmatter.description }
            : {}),
          ...(frontmatter.draft !== undefined ? { draft: frontmatter.draft } : {}),
        });
      }
    }

    return { slug, title: project.title, revision: project.revision, outline, pages };
  }

  /**
   * Adds the page-file half of an outline command to the transaction, so the
   * structure change and the file change land together or not at all.
   */
  private async stagePageFileLifecycle(
    dir: string,
    tx: Transaction,
    command: OutlineCommand,
    before: OutlineDoc,
    after: OutlineDoc,
    createdPage: CreatedPageMeta | undefined,
  ): Promise<void> {
    const trashDir = `${TRASH_DIR}/${timestampSlug(this.now())}`;

    switch (command.type) {
      case "add-page": {
        if (!createdPage) return;
        // An existing file for a freshly adopted id belongs to content the
        // caller did not mention; keeping it beats overwriting it, and its own
        // frontmatter then supplies the title.
        if (await this.pageFileExists(dir, createdPage.id)) return;
        tx.write(
          pageRelPath(createdPage.id),
          serializePageFile({ title: createdPage.title }, ""),
        );
        return;
      }

      case "remove-page": {
        tx.move(pageRelPath(command.pageId), `${trashDir}/${pageFileName(command.pageId)}`);
        return;
      }

      case "remove-category": {
        const category = before.categories.find(
          (candidate) => candidate.id === command.categoryId,
        );
        for (const page of category?.pages ?? []) {
          tx.move(pageRelPath(page.id), `${trashDir}/${pageFileName(page.id)}`);
        }
        return;
      }

      case "replace-doc": {
        const wanted = new Set(
          after.categories.flatMap((category) => category.pages.map((page) => page.id)),
        );
        const onDisk = await this.pageFileIds(dir);

        for (const category of after.categories) {
          for (const page of category.pages) {
            if (onDisk.has(page.id)) continue;
            // No frontmatter to inherit: the slug is the only title-shaped
            // thing the outline knows, and `compose` falls back the same way.
            tx.write(pageRelPath(page.id), serializePageFile({ title: page.slug }, ""));
          }
        }
        for (const id of onDisk) {
          if (!wanted.has(id)) {
            tx.move(pageRelPath(id), `${trashDir}/${pageFileName(id)}`);
          }
        }
        return;
      }

      default:
        return;
    }
  }

  private async pageFileExists(dir: string, pageId: string): Promise<boolean> {
    return (await this.readTextFile(path.join(dir, pageRelPath(pageId)))) !== null;
  }

  private async pageFileIds(dir: string): Promise<Set<string>> {
    let entries;
    try {
      entries = await readdir(path.join(dir, PAGES_DIR), { withFileTypes: true });
    } catch (error) {
      if (isMissing(error)) return new Set();
      throw error;
    }
    const ids = new Set<string>();
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(PAGE_EXTENSION)) continue;
      const id = entry.name.slice(0, -PAGE_EXTENSION.length);
      if (SAFE_PAGE_ID.test(id)) ids.add(id);
    }
    return ids;
  }

  private mintId(kind: "category" | "page"): string {
    const minted = this.createId?.(kind);
    if (typeof minted === "string" && minted.trim().length > 0) return minted.trim();
    return `${kind}-${globalThis.crypto.randomUUID()}`;
  }
}

export function createFileStore(options: FileStoreOptions): FileProjectStore {
  return new FileProjectStore(options);
}

// ------------------------------------------------------------------ helpers

export function isSafePageId(pageId: unknown): pageId is string {
  return typeof pageId === "string" && SAFE_PAGE_ID.test(pageId);
}

export function assertProjectSlug(slug: unknown): asserts slug is string {
  if (!isValidSlug(slug)) {
    throw new StoreError(
      "invalid-request",
      `"${String(slug)}" is not a valid project slug.`,
      400,
    );
  }
}

export function assertPageId(pageId: unknown): asserts pageId is string {
  if (!isSafePageId(pageId)) {
    throw new StoreError(
      "invalid-request",
      `"${String(pageId)}" is not a valid page id (letters, digits, "-" and "_" only).`,
      400,
    );
  }
}

/**
 * Page ids become filenames, so the store rejects unsafe ones before the core
 * ever sees them — the core's id rules are looser on purpose (it has no
 * filesystem) and this is where the filesystem's rules get added.
 */
function assertFileSafeCommand(command: OutlineCommand): void {
  if (command.type === "add-page" && command.pageId !== undefined) {
    assertPageId(command.pageId);
  }
  if (command.type === "replace-doc") {
    const doc = command.doc;
    if (typeof doc !== "object" || doc === null || !Array.isArray(doc.categories)) {
      // Shape problems are the core's to report, with a better message.
      return;
    }
    for (const category of doc.categories) {
      // Anything that is not a page id in the expected shape is left entirely
      // to `validateOutlineDoc`, which explains it better than a filename rule
      // could — and which is why this loop must not throw on the way there.
      if (!Array.isArray(category?.pages)) continue;
      for (const page of category.pages) {
        if (typeof page?.id === "string") assertPageId(page.id);
      }
    }
  }
}

function locatePage(
  outline: OutlineDoc,
  pageId: string,
): { slug: string; categoryId: string } | null {
  const owner = findPageOwner(outline, pageId);
  const page = owner?.pages.find((candidate) => candidate.id === pageId);
  if (!owner || !page) return null;
  return { slug: page.slug, categoryId: owner.id };
}

function frontmatterFromMeta(meta: {
  title: string;
  description?: string;
  draft?: boolean;
}): PageFrontmatter {
  return {
    title: meta.title,
    ...(meta.description !== undefined ? { description: meta.description } : {}),
    ...(meta.draft !== undefined ? { draft: meta.draft } : {}),
  };
}

function projectFileFor(title: string, revision: number): ProjectFile {
  return { schemaVersion: PROJECT_SCHEMA_VERSION, title, revision };
}

function pageFileName(pageId: string): string {
  return `${pageId}${PAGE_EXTENSION}`;
}

function pageRelPath(pageId: string): string {
  assertPageId(pageId);
  return `${PAGES_DIR}/${pageFileName(pageId)}`;
}

function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Filename-safe instant: `2026-08-10T04-12-33-091Z`. */
function timestampSlug(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function assertInside(root: string, target: string): void {
  const resolved = path.resolve(target);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new StoreError(
      "unsafe-path",
      "Refusing to read outside the data directory.",
      400,
    );
  }
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
}
