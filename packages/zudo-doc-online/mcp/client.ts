/**
 * Thin fetch wrapper over the zudo-doc online REST API.
 *
 * This is the only file that knows the API's URLs and wire shapes. Every
 * failure — a 4xx/5xx response, an unreachable server, a non-JSON body —
 * becomes an `ApiError` rather than a raw fetch rejection, so `tools.ts` has
 * exactly one thing to catch.
 *
 * The type-only imports below are the wire contract shared with the server
 * (epic #3327's REST shapes) and the outline core's command vocabulary; they
 * are erased at compile time, so this module has no runtime dependency on
 * server internals — only on the HTTP surface it calls.
 */

import type { AuthoringWarning } from "../server/authoring-lint";
import type { PageFrontmatter } from "../server/store/frontmatter";
import type { PageSummary, ProjectSnapshot, ProjectSummary } from "../server/store/file-store";
import type { CreatedPageMeta, OutlineCommand } from "../src/core/outline/index";

export type {
  AuthoringWarning,
  CreatedPageMeta,
  OutlineCommand,
  PageFrontmatter,
  PageSummary,
  ProjectSnapshot,
  ProjectSummary,
};

export interface PageDocument {
  id: string;
  slug: string;
  categoryId: string;
  revision: number;
  frontmatter: PageFrontmatter;
  markdown: string;
  warnings: AuthoringWarning[];
}

export interface OutlineCommandResult {
  revision: number;
  changed: boolean;
  selectedId: string | null;
  createdPage?: CreatedPageMeta;
  snapshot: ProjectSnapshot;
}

export interface PageWriteResult {
  id: string;
  slug: string;
  categoryId: string;
  revision: number;
  changed: boolean;
  frontmatter: PageFrontmatter;
  markdown: string;
  warnings: AuthoringWarning[];
}

/**
 * Every failure the client can produce. `code` mirrors the server's
 * `error.code` for an HTTP failure (see `server/app.ts`), or is one of this
 * client's own codes (`network-error`, `invalid-response`) for a failure the
 * server never got to answer. `snapshot` is present only for a
 * `revision-mismatch` (the server's 409 body), which is what `tools.ts` maps
 * to a `stale-revision` tool error.
 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly snapshot?: ProjectSnapshot,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ZudoDocOnlineClientOptions {
  /** Defaults to env `ZUDO_DOC_ONLINE_API`, then `http://127.0.0.1:4324`. */
  baseUrl?: string;
  /**
   * Injectable so tests can wire this client against an in-process app
   * (`app.request`) instead of opening a real socket.
   */
  fetch?: typeof fetch;
}

const DEFAULT_BASE_URL = "http://127.0.0.1:4324";

export class ZudoDocOnlineClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ZudoDocOnlineClientOptions = {}) {
    const base = options.baseUrl ?? process.env["ZUDO_DOC_ONLINE_API"] ?? DEFAULT_BASE_URL;
    this.baseUrl = base.replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? fetch;
  }

  listProjects(): Promise<ProjectSummary[]> {
    return this.request<ProjectSummary[]>("GET", "/api/projects");
  }

  createProject(title: string): Promise<ProjectSnapshot> {
    return this.request<ProjectSnapshot>("POST", "/api/projects", { title });
  }

  getProject(project: string): Promise<ProjectSnapshot> {
    return this.request<ProjectSnapshot>("GET", `/api/projects/${encodeURIComponent(project)}`);
  }

  applyOutlineCommand(
    project: string,
    input: { expectedRevision: number; command: OutlineCommand; clientId?: string },
  ): Promise<OutlineCommandResult> {
    return this.request<OutlineCommandResult>(
      "POST",
      `/api/projects/${encodeURIComponent(project)}/outline/commands`,
      input,
    );
  }

  getPage(project: string, pageId: string): Promise<PageDocument> {
    return this.request<PageDocument>(
      "GET",
      `/api/projects/${encodeURIComponent(project)}/pages/${encodeURIComponent(pageId)}`,
    );
  }

  writePage(
    project: string,
    pageId: string,
    input: { expectedRevision: number; frontmatter?: PageFrontmatter; markdown?: string; clientId?: string },
  ): Promise<PageWriteResult> {
    return this.request<PageWriteResult>(
      "PUT",
      `/api/projects/${encodeURIComponent(project)}/pages/${encodeURIComponent(pageId)}`,
      input,
    );
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        ...(body !== undefined
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
          : {}),
      });
    } catch (error) {
      throw new ApiError(
        "network-error",
        `Could not reach the zudo-doc online API at ${this.baseUrl} — is "pnpm --filter zudo-doc-online dev:server" running? (${error instanceof Error ? error.message : String(error)})`,
        0,
      );
    }

    let text: string;
    try {
      // `fetch` resolves as soon as headers arrive; a connection that drops
      // while the body streams in fails here, not above — that failure is
      // just as much a "could not reach the API" case as a rejected fetch.
      text = await response.text();
    } catch (error) {
      throw new ApiError(
        "network-error",
        `Lost the connection to the zudo-doc online API while reading its response (${error instanceof Error ? error.message : String(error)}).`,
        0,
      );
    }

    let parsed: unknown;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = undefined;
      }
    }

    if (!response.ok) {
      const errorBody = parsed as
        | { error?: { code?: string; message?: string }; snapshot?: ProjectSnapshot }
        | undefined;
      throw new ApiError(
        errorBody?.error?.code ?? "http-error",
        errorBody?.error?.message ?? `Request failed with status ${response.status}.`,
        response.status,
        errorBody?.snapshot,
      );
    }

    if (parsed === undefined) {
      throw new ApiError(
        "invalid-response",
        "The zudo-doc online API returned a response that was not valid JSON.",
        response.status,
      );
    }
    return parsed as T;
  }
}
