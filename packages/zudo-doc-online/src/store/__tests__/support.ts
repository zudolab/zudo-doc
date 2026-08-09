/**
 * Shared fixtures for the store suite: a small deterministic outline + pages,
 * and a fake `EventSourceLike` the events-client tests drive by hand (jsdom's
 * `EventSource` is unavailable in this package's default `node` test
 * environment, and a real one would defeat the point of a unit test anyway).
 */

import type { IdFactory, OutlineDoc } from "../../core/outline/index";
import type { EventSourceFactory, EventSourceLike } from "../events";
import {
  createMemoryProjectStore,
  type MemoryProjectStore,
  type MemoryProjectStoreOptions,
} from "../memory-provider";

export function sequentialIds(prefix = "new"): IdFactory {
  const counters: Record<string, number> = {};
  return (kind) => {
    counters[kind] = (counters[kind] ?? 0) + 1;
    return `${kind}-${prefix}-${counters[kind]}`;
  };
}

const fixtureOutline: OutlineDoc = {
  schemaVersion: 1,
  projectTitle: "Test Project",
  categories: [
    {
      id: "cat-1",
      slug: "guides",
      title: "Guides",
      pages: [
        { id: "page-1", slug: "intro" },
        { id: "page-2", slug: "advanced" },
      ],
    },
  ],
};

export function freshOutline(): OutlineDoc {
  return structuredClone(fixtureOutline);
}

export function createTestStore(
  overrides: Partial<MemoryProjectStoreOptions> = {},
): MemoryProjectStore {
  return createMemoryProjectStore({
    slug: "docs",
    title: "Test Project",
    outline: freshOutline(),
    pages: {
      "page-1": { frontmatter: { title: "Intro" }, markdown: "Hello\n" },
      "page-2": { frontmatter: { title: "Advanced" }, markdown: "World\n" },
    },
    createId: sequentialIds(),
    ...overrides,
  });
}

export class FakeEventSource implements EventSourceLike {
  onopen: ((this: EventSourceLike, ev: Event) => unknown) | null = null;
  onmessage: ((this: EventSourceLike, ev: MessageEvent) => unknown) | null = null;
  onerror: ((this: EventSourceLike, ev: Event) => unknown) | null = null;
  closed = false;

  close(): void {
    this.closed = true;
  }

  emitOpen(): void {
    this.onopen?.call(this, {} as Event);
  }

  emitMessage(data: unknown): void {
    this.onmessage?.call(this, { data: JSON.stringify(data) } as MessageEvent);
  }

  emitRawMessage(data: string): void {
    this.onmessage?.call(this, { data } as MessageEvent);
  }

  emitError(): void {
    this.onerror?.call(this, {} as Event);
  }
}

export interface FakeEventSourceHandle {
  factory: EventSourceFactory;
  /** Every instance created so far, oldest first — index 0 is the initial connection. */
  instances: FakeEventSource[];
}

export function createFakeEventSourceFactory(): FakeEventSourceHandle {
  const instances: FakeEventSource[] = [];
  const factory: EventSourceFactory = () => {
    const source = new FakeEventSource();
    instances.push(source);
    return source;
  };
  return { factory, instances };
}
