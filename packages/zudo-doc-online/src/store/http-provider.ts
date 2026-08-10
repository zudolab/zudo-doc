/**
 * The fetch-based `ProjectStore` implementation, talking to `/api` (the Vite
 * dev proxy forwards this to the local API server on port 4324).
 *
 * Every mutation carries the tab's `clientId` (`client-id.ts`) so the server
 * can echo it back as the SSE event's `origin` — that is how `events.ts`
 * later tells "my own change" from "someone else's".
 */

import type { OutlineCommand } from "../core/outline/index";
import { getClientId } from "./client-id";
import {
  RevisionConflictError,
  StoreRequestError,
  type OutlineCommandResult,
  type PagePayload,
  type PageSaveResult,
  type PageWriteInput,
  type ProjectSnapshot,
  type ProjectStore,
  type StoreErrorCode,
} from "./contract";

export interface HttpProjectStoreOptions {
  projectSlug: string;
  /** Defaults to `/api`. */
  baseUrl?: string;
  /** Defaults to the tab's persisted id (`client-id.ts`). */
  clientId?: string;
  /** Injectable so tests never perform a real network call. */
  fetchImpl?: typeof fetch;
}

interface ErrorBody {
  error?: { code?: unknown; message?: unknown };
  snapshot?: ProjectSnapshot;
}

export function createHttpProjectStore(
  options: HttpProjectStoreOptions,
): ProjectStore {
  const baseUrl = options.baseUrl ?? "/api";
  const clientId = options.clientId ?? getClientId();
  const fetchImpl = options.fetchImpl ?? fetch;
  const projectPath = `${baseUrl}/projects/${options.projectSlug}`;

  async function send(path: string, init?: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchImpl(path, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      });
    } catch (error) {
      throw new StoreRequestError(
        "network-error",
        error instanceof Error ? error.message : "The request could not be sent.",
        0,
      );
    }

    const body = await readJsonBody(response);
    if (!response.ok) {
      throw errorFromResponse(response.status, body);
    }
    return body;
  }

  return {
    async loadSnapshot(): Promise<ProjectSnapshot> {
      return (await send(projectPath)) as ProjectSnapshot;
    },

    async applyOutlineCommand(
      expectedRevision: number,
      command: OutlineCommand,
    ): Promise<OutlineCommandResult> {
      return (await send(`${projectPath}/outline/commands`, {
        method: "POST",
        body: JSON.stringify({ expectedRevision, command, clientId }),
      })) as OutlineCommandResult;
    },

    async loadPage(id: string): Promise<PagePayload> {
      return (await send(`${projectPath}/pages/${id}`)) as PagePayload;
    },

    async savePage(
      id: string,
      expectedRevision: number,
      input: PageWriteInput,
    ): Promise<PageSaveResult> {
      return (await send(`${projectPath}/pages/${id}`, {
        method: "PUT",
        body: JSON.stringify({ expectedRevision, ...input, clientId }),
      })) as PageSaveResult;
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
 * 409 is the one status that ever carries a `snapshot` (the server's
 * `StoreError` attaches it only for `revision-mismatch`) — matching on the
 * status alone, per the API's own contract, rather than trusting a snapshot
 * that some other error shape happened to include.
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

  if (status === 409 && parsed.snapshot) {
    return new RevisionConflictError(message, parsed.snapshot);
  }
  return new StoreRequestError(code, message, status);
}
