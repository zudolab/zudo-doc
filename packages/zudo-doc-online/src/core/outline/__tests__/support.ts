import type {
  CommandFailure,
  CommandResult,
  CommandSuccess,
  IdFactory,
  OutlineDoc,
} from "../types";

/** Deterministic replacement for the uuid-based default factory. */
export function sequentialIds(): IdFactory {
  const counters = new Map<string, number>();
  return (kind) => {
    const next = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, next);
    return `${kind}-${next}`;
  };
}

const fixture: OutlineDoc = {
  schemaVersion: 1,
  projectTitle: "Test Project",
  categories: [
    {
      id: "cat-a",
      slug: "alpha",
      title: "Alpha",
      pages: [
        { id: "page-a1", slug: "one" },
        { id: "page-a2", slug: "two" },
        { id: "page-a3", slug: "three" },
      ],
    },
    {
      id: "cat-b",
      slug: "beta",
      title: "Beta",
      pages: [{ id: "page-b1", slug: "solo" }],
    },
    { id: "cat-c", slug: "gamma", title: "Gamma", pages: [] },
  ],
};

/** A fresh copy of the shared fixture, so specs can never leak state. */
export function testDoc(): OutlineDoc {
  return structuredClone(fixture);
}

export function expectOk(result: CommandResult): CommandSuccess {
  if (!result.ok) {
    throw new Error(`Expected success, got ${result.code}: ${result.message}`);
  }
  return result;
}

export function expectFail(result: CommandResult): CommandFailure {
  if (result.ok) {
    throw new Error(
      `Expected failure, got a success with changed=${result.changed}`,
    );
  }
  return result;
}

export function pageSlugs(doc: OutlineDoc, categoryId: string): string[] {
  return (
    doc.categories
      .find((category) => category.id === categoryId)
      ?.pages.map((page) => page.slug) ?? []
  );
}

export function pageIds(doc: OutlineDoc, categoryId: string): string[] {
  return (
    doc.categories
      .find((category) => category.id === categoryId)
      ?.pages.map((page) => page.id) ?? []
  );
}

export function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}
