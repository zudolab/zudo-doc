/**
 * Fixtures for the dashboard suite: seeded memory directory stores (the
 * house pattern — a spec written against `MemoryProjectsDirectoryStore`
 * stays true of the real API, see that provider's header) and a hand-driven
 * fake for the global projects SSE subscription.
 */

import { act } from "preact/test-utils";
import {
  createMemoryProjectsDirectoryStore,
  type MemoryDirectoryProjectSeed,
  type MemoryProjectsDirectoryStore,
} from "../../../store/projects-memory-provider";
import type {
  ProjectsEventEnvelope,
  SubscribeProjectsChangedListener,
} from "../../../store/projects-events";

export const AURORA_SEED: MemoryDirectoryProjectSeed = {
  slug: "aurora-docs",
  title: "Aurora Docs",
  outline: {
    schemaVersion: 1,
    projectTitle: "Aurora Docs",
    categories: [
      {
        id: "cat-start",
        slug: "getting-started",
        title: "Getting started",
        pages: [
          { id: "page-intro", slug: "index" },
          { id: "page-install", slug: "installation" },
        ],
      },
      {
        id: "cat-guides",
        slug: "guides",
        title: "Guides",
        pages: [{ id: "page-theming", slug: "theming" }],
      },
    ],
  },
  pages: [
    { id: "page-intro", slug: "index", categoryId: "cat-start", title: "Introduction" },
    {
      id: "page-install",
      slug: "installation",
      categoryId: "cat-start",
      title: "Installation",
      draft: true,
    },
    { id: "page-theming", slug: "theming", categoryId: "cat-guides", title: "Theming" },
  ],
  createdAt: "2026-01-05T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  preset: { schemaVersion: 1, themePack: "aurora", defaultMode: "system" },
};

export const TEAM_SEED: MemoryDirectoryProjectSeed = {
  slug: "team-onboarding",
  title: "Team Onboarding",
  outline: {
    schemaVersion: 1,
    projectTitle: "Team Onboarding",
    categories: [
      {
        id: "cat-week1",
        slug: "week-1",
        title: "Week 1",
        pages: [{ id: "page-checklist", slug: "checklist" }],
      },
    ],
  },
  pages: [
    {
      id: "page-checklist",
      slug: "checklist",
      categoryId: "cat-week1",
      title: "Week 1 Checklist",
    },
  ],
};

export const WEEKEND_SEED: MemoryDirectoryProjectSeed = {
  slug: "weekend-notes",
  title: "Weekend Notes",
  outline: {
    schemaVersion: 1,
    projectTitle: "Weekend Notes",
    categories: [
      {
        id: "cat-notes",
        slug: "notes",
        title: "Notes",
        pages: [
          { id: "page-scratch", slug: "scratch" },
          { id: "page-ideas", slug: "ideas" },
        ],
      },
    ],
  },
  pages: [
    {
      id: "page-scratch",
      slug: "scratch",
      categoryId: "cat-notes",
      title: "Scratch",
      draft: true,
    },
    { id: "page-ideas", slug: "ideas", categoryId: "cat-notes", title: "Ideas", draft: true },
  ],
};

export function createDashboardTestStore(
  seeds: MemoryDirectoryProjectSeed[] = [AURORA_SEED, TEAM_SEED, WEEKEND_SEED],
): MemoryProjectsDirectoryStore {
  return createMemoryProjectsDirectoryStore({ projects: seeds });
}

export interface FakeProjectsEvents {
  subscribe: (listener: SubscribeProjectsChangedListener) => () => void;
  listeners: SubscribeProjectsChangedListener[];
  emit: (envelope: ProjectsEventEnvelope) => void;
  open: () => void;
  unsubscribed: number;
}

/** A stand-in for `subscribeProjectsChanged` the spec drives by hand. */
export function createFakeProjectsEvents(): FakeProjectsEvents {
  const fake: FakeProjectsEvents = {
    listeners: [],
    unsubscribed: 0,
    subscribe(listener) {
      fake.listeners.push(listener);
      return () => {
        fake.listeners = fake.listeners.filter((entry) => entry !== listener);
        fake.unsubscribed += 1;
      };
    },
    emit(envelope) {
      for (const listener of [...fake.listeners]) listener.onEvent(envelope);
    },
    open() {
      for (const listener of [...fake.listeners]) listener.onOpen?.();
    },
  };
  return fake;
}

/** Lets pending store promises resolve and the effects they trigger run. */
export async function settle(ticks = 3): Promise<void> {
  for (let index = 0; index < ticks; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

export function queryByText<T extends Element = HTMLElement>(
  container: Element,
  selector: string,
  text: string,
): T | undefined {
  return [...container.querySelectorAll<T>(selector)].find(
    (element) => element.textContent?.trim() === text,
  );
}

export function requireByText<T extends Element = HTMLElement>(
  container: Element,
  selector: string,
  text: string,
): T {
  const element = queryByText<T>(container, selector, text);
  if (!element) throw new Error(`No "${selector}" element with text "${text}".`);
  return element;
}
