/**
 * Shared fixtures for the server suite.
 *
 * Every test gets its own temporary `data/` directory, so the suite never
 * touches the developer's real store and files can be inspected directly to
 * prove what a commit actually wrote.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { IdFactory } from "../../src/core/outline/index";
import { createApp } from "../app";
import { EventBus } from "../events";
import { createFileStore, type FileProjectStore } from "../store/file-store";

export interface TestHarness {
  dataDir: string;
  store: FileProjectStore;
  events: EventBus;
  app: ReturnType<typeof createApp>;
  cleanup: () => Promise<void>;
}

/** Deterministic ids: `category-1`, `page-1`, `page-2`, … */
export function sequentialIds(): IdFactory {
  const counters = { category: 0, page: 0 };
  return (kind) => {
    counters[kind] += 1;
    return `${kind}-${counters[kind]}`;
  };
}

/** Fixed clock so trash directory names are predictable. */
export function fixedClock(iso = "2026-01-02T03:04:05.678Z"): () => Date {
  return () => new Date(iso);
}

export async function createHarness(
  options: { now?: () => Date } = {},
): Promise<TestHarness> {
  const dataDir = await mkdtemp(path.join(tmpdir(), "zdo-store-"));
  const store = createFileStore({
    dataDir,
    createId: sequentialIds(),
    ...(options.now ? { now: options.now } : {}),
  });
  const events = new EventBus();

  return {
    dataDir,
    store,
    events,
    app: createApp({ store, events }),
    cleanup: () => rm(dataDir, { recursive: true, force: true }),
  };
}

/** Convenience for asserting on a JSON response without repeating the cast. */
export async function json<T = Record<string, unknown>>(
  response: Response,
): Promise<T> {
  return (await response.json()) as T;
}
