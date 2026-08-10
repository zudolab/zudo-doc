/**
 * The transport-agnostic **project-list-level** store contract — separate
 * from `contract.ts`'s `ProjectStore`, which is scoped to one already-open
 * project and whose `revision-coordinator.ts` FIFO-queue model doesn't fit
 * project-level ops (create/delete/duplicate/list have no "current revision"
 * to serialize against). This is the projects DIRECTORY: the dashboard's
 * master list, plus the wizard's create path.
 *
 * Shapes mirror the epic's locked wire contract
 * (zudolab/zudo-doc#3345, "Locked wire contract" section) field for field —
 * the server sub-issue's implementation runs in parallel, so this file codes
 * against that contract text, not against the server's in-flight code. Two
 * providers implement `ProjectsDirectoryStore`: `projects-http-provider.ts`
 * (real server) and `projects-memory-provider.ts` (tests, and a future
 * offline mode) — same split as `contract.ts`'s per-project pair.
 *
 * Errors reuse `contract.ts`'s `StoreRequestError` taxonomy and
 * `StoreErrorCode` union unchanged: a 404 maps to `"project-not-found"`, a
 * network failure to `"network-error"` with `status: 0`, and so on. No new
 * error codes are introduced here.
 */

import type { PageSummary } from "./contract";
import type { OutlineDoc } from "../core/outline/index";

/**
 * `schemaVersion` is a required literal 1 inside a preset, per the locked
 * contract — unknown inner keys are tolerated and preserved across commits by
 * the server, so this type only declares the fields the SPA actually reads
 * or writes; a real payload may carry more.
 */
export interface ProjectPreset {
  schemaVersion: 1;
  themePack?: string;
  colorScheme?: string;
  defaultMode?: "light" | "dark" | "system";
  features?: string[];
}

/**
 * One row of `GET /api/projects`. The summary fields
 * (`pageCount`/`draftCount`/`categoryCount`/`createdAt`/`updatedAt`/`preset`)
 * are present only when `listProjects` was called with `{summary: true}` —
 * modeled as optional on one shape (matching `contract.ts`'s `PageSummary`
 * convention) rather than a discriminated union, since the caller always
 * knows which it asked for.
 */
export interface ProjectListEntry {
  slug: string;
  title: string;
  revision: number;
  pageCount?: number;
  draftCount?: number;
  categoryCount?: number;
  createdAt?: string;
  updatedAt?: string;
  preset?: ProjectPreset;
}

export interface ListProjectsOptions {
  summary?: boolean;
}

/**
 * The dashboard detail pane needs outline-ordered pages, so `getProject`
 * returns the full per-project snapshot shape (`ProjectSnapshot` from
 * `./contract`) plus the directory-level fields (`createdAt`/`updatedAt`/
 * `preset`) list/create/delete/duplicate alone cannot power.
 */
export interface ProjectDirectorySnapshot {
  slug: string;
  title: string;
  revision: number;
  outline: OutlineDoc;
  pages: PageSummary[];
  createdAt?: string;
  updatedAt?: string;
  preset?: ProjectPreset;
}

export interface DeleteProjectResult {
  slug: string;
  deleted: true;
}

export interface ProjectsDirectoryStore {
  listProjects(options?: ListProjectsOptions): Promise<ProjectListEntry[]>;
  getProject(slug: string): Promise<ProjectDirectorySnapshot>;
  /** `preset`, when given, is sent verbatim — the server fills `schemaVersion` defaults. */
  createProject(title: string, preset?: ProjectPreset): Promise<ProjectDirectorySnapshot>;
  deleteProject(slug: string): Promise<DeleteProjectResult>;
  duplicateProject(slug: string): Promise<ProjectDirectorySnapshot>;
}
