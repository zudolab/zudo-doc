/**
 * The fetch-based `ProjectsDirectoryStore` implementation, talking to
 * `/api/projects` (the Vite dev proxy forwards this to the local API server
 * on port 4324) — the project-list counterpart of `http-provider.ts`.
 *
 * `clientId` placement follows the locked wire contract exactly: a **body**
 * field for `createProject`/`duplicateProject` (both POST with a JSON body
 * already), and a **query param** for `deleteProject` (DELETE has no body).
 * Same reasoning as the per-project provider: the server echoes it back as
 * the SSE event's `origin` so `projects-events.ts` can tell "my own change"
 * from "someone else's".
 */

import { getClientId } from "./client-id";
import { StoreRequestError, type StoreErrorCode } from "./contract";
import type {
  DeleteProjectResult,
  ListProjectsOptions,
  ProjectDirectorySnapshot,
  ProjectListEntry,
  ProjectPreset,
  ProjectsDirectoryStore,
} from "./projects-directory";

export interface HttpProjectsDirectoryStoreOptions {
  /** Defaults to `/api`. */
  baseUrl?: string;
  /** Defaults to the tab's persisted id (`client-id.ts`). */
  clientId?: string;
  /** Injectable so tests never perform a real network call. */
  fetchImpl?: typeof fetch;
}

interface ErrorBody {
  error?: { code?: unknown; message?: unknown };
}

export function createHttpProjectsDirectoryStore(
  options: HttpProjectsDirectoryStoreOptions = {},
): ProjectsDirectoryStore {
  const baseUrl = options.baseUrl ?? "/api";
  const clientId = options.clientId ?? getClientId();
  const fetchImpl = options.fetchImpl ?? fetch;
  const projectsPath = `${baseUrl}/projects`;

  async function send(path: string, init?: RequestInit): Promise<unknown> {
    let response: Response;
    let body: unknown;
    try {
      response = await fetchImpl(path, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      });
      // Reading the body is folded into this same try: a connection that
      // drops mid-stream (headers already received, body read rejects) must
      // still classify as `network-error`, not leak the raw stream error.
      body = await readJsonBody(response);
    } catch (error) {
      throw new StoreRequestError(
        "network-error",
        error instanceof Error ? error.message : "The request could not be sent.",
        0,
      );
    }

    if (!response.ok) {
      throw errorFromResponse(response.status, body);
    }
    return body;
  }

  return {
    async listProjects(listOptions?: ListProjectsOptions): Promise<ProjectListEntry[]> {
      const query = listOptions?.summary ? "?summary=1" : "";
      return (await send(`${projectsPath}${query}`)) as ProjectListEntry[];
    },

    async getProject(slug: string): Promise<ProjectDirectorySnapshot> {
      return (await send(`${projectsPath}/${slug}`)) as ProjectDirectorySnapshot;
    },

    async createProject(
      title: string,
      preset?: ProjectPreset,
    ): Promise<ProjectDirectorySnapshot> {
      return (await send(projectsPath, {
        method: "POST",
        body: JSON.stringify({ title, ...(preset ? { preset } : {}), clientId }),
      })) as ProjectDirectorySnapshot;
    },

    async deleteProject(slug: string): Promise<DeleteProjectResult> {
      return (await send(
        `${projectsPath}/${slug}?clientId=${encodeURIComponent(clientId)}`,
        { method: "DELETE" },
      )) as DeleteProjectResult;
    },

    async duplicateProject(slug: string): Promise<ProjectDirectorySnapshot> {
      return (await send(`${projectsPath}/${slug}/duplicate`, {
        method: "POST",
        body: JSON.stringify({ clientId }),
      })) as ProjectDirectorySnapshot;
    },
  };
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Mirrors `http-provider.ts`'s `errorFromResponse` (duplicated rather than
 * imported — that function is module-private there, and this provider must
 * stay independently readable). No directory-level operation is
 * revision-scoped, so unlike the per-project provider there is no 409/
 * snapshot special case: every failure maps to a plain `StoreRequestError`.
 */
function errorFromResponse(status: number, body: unknown): StoreRequestError {
  const parsed = (body ?? {}) as ErrorBody;
  const code: StoreErrorCode =
    typeof parsed.error?.code === "string"
      ? (parsed.error.code as StoreErrorCode)
      : "http-error";
  const message =
    typeof parsed.error?.message === "string"
      ? parsed.error.message
      : `Request failed with status ${status}.`;

  return new StoreRequestError(code, message, status);
}
