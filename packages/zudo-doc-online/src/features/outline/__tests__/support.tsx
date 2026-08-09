/**
 * Fixtures and DOM helpers for the outline-surface suite.
 *
 * Component specs drive the REAL memory provider through the REAL revision
 * coordinator rather than a hand-written stub, so a test that says "the
 * rename round-trips" is asserting against the same command semantics the
 * API server runs (`memory-provider.ts` reuses the outline core's
 * `applyCommand`). The only thing faked is persistence.
 *
 * `flush` wraps preact's own `act`, which makes queued renders and effects
 * run synchronously; the timeout inside it drains the store's promises in
 * between, since `act` alone does not know about them.
 */

import { render, type VNode } from "preact";
import { act } from "preact/test-utils";
import type { OutlineDoc } from "../../../core/outline/index.js";
import type {
  PageSummary,
  ProjectSnapshot,
  ProjectStore,
} from "../../../store/contract.js";
import {
  createMemoryProjectStore,
  type MemoryProjectStore,
} from "../../../store/memory-provider.js";
import {
  createCoordinatedStore,
  type RevisionCoordinator,
} from "../../../store/revision-coordinator.js";
import type { ViewPreferenceStorage } from "../view-preference.js";

const FIXTURE_OUTLINE: OutlineDoc = {
  schemaVersion: 1,
  projectTitle: "Test Project",
  categories: [
    {
      id: "cat-alpha",
      slug: "alpha",
      title: "Alpha",
      pages: [
        { id: "page-alpha-index", slug: "index" },
        { id: "page-alpha-one", slug: "one" },
        { id: "page-alpha-two", slug: "two" },
      ],
    },
    {
      id: "cat-beta",
      slug: "beta",
      title: "Beta",
      // Shares the `index` slug with Alpha on purpose: that is the move
      // rejection the picker has to warn about before the click.
      pages: [{ id: "page-beta-index", slug: "index" }],
    },
    { id: "cat-gamma", slug: "gamma", title: "Gamma", pages: [] },
  ],
};

const FIXTURE_PAGES: PageSummary[] = [
  {
    id: "page-alpha-index",
    slug: "index",
    categoryId: "cat-alpha",
    title: "Alpha",
    description: "Everything in the alpha section.",
  },
  { id: "page-alpha-one", slug: "one", categoryId: "cat-alpha", title: "One" },
  {
    id: "page-alpha-two",
    slug: "two",
    categoryId: "cat-alpha",
    title: "Two",
    draft: true,
  },
  { id: "page-beta-index", slug: "index", categoryId: "cat-beta", title: "Beta" },
];

export function testOutline(): OutlineDoc {
  return structuredClone(FIXTURE_OUTLINE);
}

export function testSnapshot(revision = 4): ProjectSnapshot {
  return {
    slug: "test-project",
    title: "Test Project",
    revision,
    outline: testOutline(),
    pages: structuredClone(FIXTURE_PAGES),
  };
}

export interface TestWiring {
  /** The provider, for asserting server state and staging external writes. */
  memory: MemoryProjectStore;
  /** What the surface talks to. */
  store: ProjectStore;
  coordinator: RevisionCoordinator;
}

/** Unique across the whole suite so no two mounted trees can mint the same id. */
let idCounter = 0;

export function createWiring(): TestWiring {
  const memory = createMemoryProjectStore({
    slug: "test-project",
    title: "Test Project",
    outline: testOutline(),
    pages: Object.fromEntries(
      FIXTURE_PAGES.map((page) => [
        page.id,
        {
          frontmatter: {
            title: page.title,
            ...(page.description === undefined
              ? {}
              : { description: page.description }),
            ...(page.draft === undefined ? {} : { draft: page.draft }),
          },
          markdown: `${page.title} body\n`,
        },
      ]),
    ),
    revision: 4,
    createId: (kind) => `${kind}-new-${(idCounter += 1)}`,
  });
  const coordinated = createCoordinatedStore(memory, 0);
  return { memory, store: coordinated.store, coordinator: coordinated.coordinator };
}

export function memoryViewStorage(
  initial: Record<string, string> = {},
): ViewPreferenceStorage & { values: Record<string, string> } {
  const values = { ...initial };
  return {
    values,
    getItem: (key) => values[key] ?? null,
    setItem: (key, value) => {
      values[key] = value;
    },
  };
}

export interface Mounted {
  container: HTMLElement;
  unmount(): void;
}

export async function mount(vnode: VNode): Promise<Mounted> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(() => {
    render(vnode, container);
  });
  await flush();
  return {
    container,
    unmount: () => {
      render(null, container);
      container.remove();
    },
  };
}

/** Runs queued renders/effects and lets the store's promises settle. */
export async function flush(rounds = 3): Promise<void> {
  for (let round = 0; round < rounds; round += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    });
  }
}

export function byLabel(container: HTMLElement, label: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (found === null) {
    throw new Error(`No element with aria-label "${label}".`);
  }
  return found;
}

export function queryByLabel(
  container: HTMLElement,
  label: string,
): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
}

export function buttonWithText(
  container: HTMLElement,
  text: string,
): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (button) => (button.textContent ?? "").trim() === text,
  );
  if (found === undefined) {
    throw new Error(`No button reading "${text}".`);
  }
  return found;
}

export function buttonContaining(
  container: HTMLElement,
  text: string,
): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find((button) =>
    (button.textContent ?? "").includes(text),
  );
  if (found === undefined) {
    throw new Error(`No button containing "${text}".`);
  }
  return found;
}

export async function click(element: Element): Promise<void> {
  await act(() => {
    (element as HTMLElement).click();
  });
  await flush();
}

export async function pressKey(
  element: Element,
  key: string,
  init: KeyboardEventInit = {},
): Promise<void> {
  await act(() => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, ...init }),
    );
  });
  await flush();
}

export async function compose(
  element: Element,
  type: "compositionstart" | "compositionend",
): Promise<void> {
  await act(() => {
    element.dispatchEvent(new CompositionEvent(type, { bubbles: true }));
  });
}

export function typeInto(input: HTMLInputElement, value: string): void {
  // The field is uncontrolled (see `inline-edit-field.tsx`), so setting the
  // DOM value is exactly what a real keystroke leaves behind.
  input.value = value;
}
