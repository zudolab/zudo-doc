/**
 * The transport-agnostic store contract the SPA edits through.
 *
 * These shapes mirror the live API (`packages/zudo-doc-online/server/`) field
 * for field — see that package's `app.ts` header for the shared conventions
 * (errors, the 409-carries-snapshot rule, `clientId`/`origin`). Two providers
 * implement `ProjectStore`: `http-provider.ts` (real server) and
 * `memory-provider.ts` (tests, and a future offline mode). Neither provider is
 * meant to be used directly by UI code — `revision-coordinator.ts` wraps one
 * to produce the store a page actually consumes, so that every mutation is
 * serialized against a single, always-current revision number.
 *
 * `expectedRevision` stays a literal, caller-supplied parameter on this
 * interface because it mirrors the API 1:1: a raw provider sends exactly the
 * value it is given. The coordinator (`revision-coordinator.ts`) is what
 * later ignores a caller's stale value and substitutes its own tracked one —
 * that substitution is documented there, not here.
 */

import type {
  CreatedPageMeta,
  OutlineCommand,
  OutlineDoc,
  OutlineErrorCode,
} from "../core/outline/index";

export interface PageFrontmatter {
  title: string;
  description?: string;
  draft?: boolean;
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

/** The GET-page shape: no `changed` flag, because a read never has one. */
export interface PagePayload {
  id: string;
  slug: string;
  categoryId: string;
  revision: number;
  frontmatter: PageFrontmatter;
  markdown: string;
  warnings: string[];
}

/** The PUT-page shape: a payload plus whether the write actually changed anything. */
export interface PageSaveResult extends PagePayload {
  changed: boolean;
}

export interface PageWriteInput {
  /** Omit to leave the stored frontmatter alone. */
  frontmatter?: PageFrontmatter;
  /** Omit to leave the stored body alone. */
  markdown?: string;
}

export interface OutlineCommandResult {
  revision: number;
  changed: boolean;
  selectedId: string | null;
  createdPage?: CreatedPageMeta;
  snapshot: ProjectSnapshot;
}

export interface ProjectStore {
  loadSnapshot(): Promise<ProjectSnapshot>;
  applyOutlineCommand(
    expectedRevision: number,
    command: OutlineCommand,
  ): Promise<OutlineCommandResult>;
  loadPage(id: string): Promise<PagePayload>;
  savePage(
    id: string,
    expectedRevision: number,
    input: PageWriteInput,
  ): Promise<PageSaveResult>;
}

/**
 * Every failure a provider can produce. Mirrors the server's `StoreErrorCode`
 * plus one client-only code (`network-error`) for a `fetch` that never got a
 * response at all (offline, DNS failure, the dev server not running).
 */
export type StoreErrorCode =
  | OutlineErrorCode
  | "project-not-found"
  | "page-not-found"
  | "revision-mismatch"
  | "invalid-request"
  | "unsafe-path"
  | "corrupt-file"
  | "forbidden-origin"
  | "payload-too-large"
  | "not-found"
  | "http-error"
  | "internal-error"
  | "network-error";

/**
 * A rejected or failed request. `status` is an HTTP status for the HTTP
 * provider; the memory provider assigns the same status codes so tests can
 * assert on one taxonomy regardless of which provider produced the error.
 */
export class StoreRequestError extends Error {
  constructor(
    readonly code: StoreErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StoreRequestError";
  }
}

/**
 * The one error code that ever carries a snapshot (epic #3327, contract 2):
 * `expectedRevision` was stale. The snapshot is the server's current state,
 * so the loser can rebase without a second round trip.
 */
export class RevisionConflictError extends StoreRequestError {
  constructor(
    message: string,
    readonly snapshot: ProjectSnapshot,
  ) {
    super("revision-mismatch", message, 409);
    this.name = "RevisionConflictError";
  }
}
