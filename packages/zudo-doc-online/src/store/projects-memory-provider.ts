/**
 * An in-memory `ProjectsDirectoryStore`, for tests today and a future
 * offline mode — the project-list counterpart of `memory-provider.ts`.
 *
 * Mirrors the server's directory behavior closely enough that a test written
 * against this provider stays true of the real API:
 *
 * - Slugs are derived and de-duplicated via the shared core
 *   `../core/outline/slugs.ts` (`deriveUniqueSlug`), the same function the
 *   outline model itself uses — never a locally re-invented slugify.
 * - `duplicateProject` rewrites the new project's title to `"<Title> copy"`
 *   (epic #3345 contract: duplicate titles are legal, no
 *   duplicate-title error path) and derives a fresh unique slug from that
 *   rewritten title, per epic #3327's title-ownership contract (project
 *   title lives in `project.json` + `outline.projectTitle`, kept in sync).
 * - `deleteProject` removes the project from the listing outright (no
 *   trash-rename semantics here — that is a server-side detail this provider
 *   has no filesystem to model).
 *
 * This module never imports from `server/`: the store stays usable outside
 * Node, matching `memory-provider.ts`'s own constraint.
 */

import type { IdFactory, OutlineDoc } from "../core/outline/index";
import { deriveUniqueSlug } from "../core/outline/slugs";
import { StoreRequestError, type PageSummary } from "./contract";
import type {
  DeleteProjectResult,
  ListProjectsOptions,
  ProjectDirectorySnapshot,
  ProjectListEntry,
  ProjectPreset,
  ProjectsDirectoryStore,
} from "./projects-directory";

interface ProjectRecord {
  slug: string;
  title: string;
  revision: number;
  outline: OutlineDoc;
  pages: PageSummary[];
  createdAt: string;
  updatedAt: string;
  preset?: ProjectPreset;
}

export interface MemoryDirectoryProjectSeed {
  /** Omit to derive (and auto-dedupe) the slug from `title`, like a real create. */
  slug?: string;
  title: string;
  outline?: OutlineDoc;
  pages?: PageSummary[];
  /** Defaults to 1, matching a freshly created project. */
  revision?: number;
  preset?: ProjectPreset;
  createdAt?: string;
  updatedAt?: string;
}

export interface MemoryProjectsDirectoryStoreOptions {
  /** Pre-seeded projects, e.g. standing in for the server's first-run seed. */
  projects?: MemoryDirectoryProjectSeed[];
  /** Injectable clock for deterministic `createdAt`/`updatedAt` in tests. */
  now?: () => string;
  /** Injectable so tests get deterministic ids from `createProject`'s scaffold. */
  createId?: IdFactory;
}

/**
 * Mirrors `server/routes/projects.ts`'s `z.string().trim().min(1).max(200)`
 * title schema, so a memory-provider test exercises the same validation
 * boundary a real request would hit.
 */
const MAX_PROJECT_TITLE_LENGTH = 200;

export class MemoryProjectsDirectoryStore implements ProjectsDirectoryStore {
  private readonly projects = new Map<string, ProjectRecord>();
  private readonly now: () => string;
  private readonly createId: IdFactory | undefined;

  constructor(options: MemoryProjectsDirectoryStoreOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId = options.createId;
    for (const seed of options.projects ?? []) {
      const slug = seed.slug ?? deriveUniqueSlug(seed.title, this.projects.keys());
      const timestamp = seed.createdAt ?? this.now();
      this.projects.set(slug, {
        slug,
        title: seed.title,
        revision: seed.revision ?? 1,
        outline: seed.outline ?? emptyOutline(seed.title),
        pages: seed.pages ?? [],
        createdAt: timestamp,
        updatedAt: seed.updatedAt ?? timestamp,
        ...(seed.preset ? { preset: seed.preset } : {}),
      });
    }
  }

  async listProjects(options?: ListProjectsOptions): Promise<ProjectListEntry[]> {
    return [...this.projects.values()].map((record) => this.toListEntry(record, options?.summary));
  }

  async getProject(slug: string): Promise<ProjectDirectorySnapshot> {
    return this.compose(this.requireProject(slug));
  }

  async createProject(
    title: string,
    preset?: ProjectPreset,
  ): Promise<ProjectDirectorySnapshot> {
    const trimmed = typeof title === "string" ? title.trim() : "";
    if (trimmed.length === 0 || trimmed.length > MAX_PROJECT_TITLE_LENGTH) {
      throw new StoreRequestError("invalid-request", "A project needs a title.", 400);
    }

    const slug = deriveUniqueSlug(trimmed, this.projects.keys());
    const timestamp = this.now();
    const categoryId = this.mintId("category");
    const pageId = this.mintId("page");
    const record: ProjectRecord = {
      slug,
      title: trimmed,
      revision: 1,
      outline: {
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
      },
      pages: [
        {
          id: pageId,
          slug: "index",
          categoryId,
          title: "Introduction",
        },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...(preset ? { preset } : {}),
    };
    this.projects.set(slug, record);
    return this.compose(record);
  }

  async deleteProject(slug: string): Promise<DeleteProjectResult> {
    this.requireProject(slug);
    this.projects.delete(slug);
    return { slug, deleted: true };
  }

  async duplicateProject(slug: string): Promise<ProjectDirectorySnapshot> {
    const source = this.requireProject(slug);
    const newTitle = `${source.title} copy`;
    const newSlug = deriveUniqueSlug(newTitle, this.projects.keys());
    const timestamp = this.now();
    const record: ProjectRecord = {
      slug: newSlug,
      title: newTitle,
      revision: 1,
      outline: { ...structuredClone(source.outline), projectTitle: newTitle },
      pages: structuredClone(source.pages),
      createdAt: timestamp,
      updatedAt: timestamp,
      ...(source.preset ? { preset: structuredClone(source.preset) } : {}),
    };
    this.projects.set(newSlug, record);
    return this.compose(record);
  }

  /** Test-only convenience: the slugs currently in the directory. */
  listSlugs(): string[] {
    return [...this.projects.keys()];
  }

  private requireProject(slug: string): ProjectRecord {
    const record = this.projects.get(slug);
    if (!record) {
      throw new StoreRequestError("project-not-found", `No project with slug "${slug}".`, 404);
    }
    return record;
  }

  /** Mirrors `server/store/file-store.ts`'s `mintId`: injectable, with a random-uuid fallback. */
  private mintId(kind: "category" | "page"): string {
    const minted = this.createId?.(kind);
    if (typeof minted === "string" && minted.trim().length > 0) return minted.trim();
    return `${kind}-${globalThis.crypto.randomUUID()}`;
  }

  private toListEntry(record: ProjectRecord, summary: boolean | undefined): ProjectListEntry {
    const base: ProjectListEntry = {
      slug: record.slug,
      title: record.title,
      revision: record.revision,
    };
    if (!summary) return base;
    return {
      ...base,
      pageCount: record.pages.length,
      draftCount: record.pages.filter((page) => page.draft === true).length,
      categoryCount: record.outline.categories.length,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      ...(record.preset ? { preset: record.preset } : {}),
    };
  }

  private compose(record: ProjectRecord): ProjectDirectorySnapshot {
    return {
      slug: record.slug,
      title: record.title,
      revision: record.revision,
      outline: record.outline,
      pages: record.pages,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      ...(record.preset ? { preset: record.preset } : {}),
    };
  }
}

export function createMemoryProjectsDirectoryStore(
  options: MemoryProjectsDirectoryStoreOptions = {},
): MemoryProjectsDirectoryStore {
  return new MemoryProjectsDirectoryStore(options);
}

function emptyOutline(title: string): OutlineDoc {
  return { schemaVersion: 1, projectTitle: title, categories: [] };
}
