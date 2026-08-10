// @vitest-environment jsdom
/**
 * The creation wizard's behavioral contract (#3351): a fixture-built catalog
 * (never real pack colors — those change with design iterations), the memory
 * directory provider standing in for the server, and the three paths that
 * are expensive to notice broken: server-slug reconciliation, the IME Enter
 * guard, and preset round-tripping.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";
import type { ThemePackMeta } from "@takazudo/zudo-doc/catalog";
import type { Route } from "../../../app/router";
import {
  MemoryProjectsDirectoryStore,
  StoreRequestError,
  type ProjectsDirectoryStore,
} from "../../../store/index";
import NewProjectRoute from "../route";

const PACK_COUNT = 31;

function makePack(index: number): ThemePackMeta {
  const mode = index % 3 === 0 ? "dark" : "light";
  const swatches = (shift: number) => ({
    bg: `rgb(${index} ${shift} 0)`,
    fg: `rgb(${index} ${shift} 1)`,
    accent: `rgb(${index} ${shift} 2)`,
    syntax: {
      keyword: `rgb(${index} ${shift} 3)`,
      string: `rgb(${index} ${shift} 4)`,
      comment: `rgb(${index} ${shift} 5)`,
      callable: `rgb(${index} ${shift} 6)`,
    },
  });
  return {
    schemaVersion: 1,
    // The real catalog carries the reserved "default" pack; the wizard
    // preselects it, so the fixture must include it too.
    slug: index === 0 ? "default" : `pack-${index}`,
    name: index === 0 ? "Default" : `Pack ${index}`,
    description: `Fixture pack number ${index}.`,
    mode,
    version: "1.0.0",
    fonts: { sans: `Sans ${index}`, mono: `Mono ${index}`, loaded: [] },
    preview: { light: swatches(100), dark: swatches(200) },
  };
}

const FIXTURE_PACKS = Array.from({ length: PACK_COUNT }, (_, i) => makePack(i));

let container: HTMLElement | undefined;

afterEach(() => {
  if (container) {
    render(null, container);
    container.remove();
    container = undefined;
  }
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-theme");
});

interface MountOptions {
  store?: ProjectsDirectoryStore;
  packs?: ThemePackMeta[];
}

function mount(options: MountOptions = {}) {
  const store = options.store ?? new MemoryProjectsDirectoryStore();
  const navigate = vi.fn<(route: Route) => void>();
  const root = document.createElement("div");
  container = root;
  document.body.appendChild(root);

  act(() => {
    render(
      <NewProjectRoute
        store={store}
        packs={options.packs ?? FIXTURE_PACKS}
        navigate={navigate}
      />,
      root,
    );
  });
  const query = <T extends Element>(selector: string): T => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`No element matching "${selector}".`);
    return element;
  };

  return {
    store,
    navigate,
    query,
    cards: () => [...root.querySelectorAll<HTMLButtonElement>("[data-pack]")],
    nameInput: () => query<HTMLInputElement>("#new-project-name"),
    createButton: () =>
      [...root.querySelectorAll<HTMLButtonElement>("button")].find((el) =>
        (el.textContent ?? "").includes("Create project"),
      )!,
  };
}

function input(element: HTMLInputElement, value: string): void {
  element.value = value;
  act(() => {
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function key(element: HTMLElement, init: KeyboardEventInit): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
  });
}

function composition(element: HTMLElement, type: "start" | "end"): void {
  act(() => {
    element.dispatchEvent(new CompositionEvent(`composition${type}`, { bubbles: true }));
  });
}

async function settle(): Promise<void> {
  await act(async () => {});
}

describe("NewProjectRoute — gallery", () => {
  it("renders one card per catalog pack, painted from the light preview by default", () => {
    const { cards } = mount();
    expect(cards()).toHaveLength(PACK_COUNT);

    const card = cards().find((el) => el.dataset.pack === "pack-7")!;
    const light = FIXTURE_PACKS[7]!.preview.light;
    expect(card.style.getPropertyValue("--pack-bg")).toBe(light.bg);
    expect(card.style.getPropertyValue("--pack-accent")).toBe(light.accent);
    expect(card.style.getPropertyValue("--pack-syn-keyword")).toBe(
      light.syntax.keyword,
    );
  });

  it("paints cards from the dark preview when the app scheme is dark", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    const { cards } = mount();
    const card = cards().find((el) => el.dataset.pack === "pack-7")!;
    expect(card.style.getPropertyValue("--pack-bg")).toBe(
      FIXTURE_PACKS[7]!.preview.dark.bg,
    );
  });

  it("preselects the default pack and swaps the sheet preview on card click", () => {
    const { cards, query } = mount();
    expect(query("[data-selected-pack]").getAttribute("data-selected-pack")).toBe(
      "default",
    );

    act(() => {
      cards()
        .find((el) => el.dataset.pack === "pack-5")!
        .click();
    });
    expect(query("[data-selected-pack]").getAttribute("data-selected-pack")).toBe(
      "pack-5",
    );
    expect(
      cards().find((el) => el.dataset.pack === "pack-5")!.getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("filter chips narrow the gallery to matching modes", () => {
    const { cards, query } = mount();
    const darkCount = FIXTURE_PACKS.filter((pack) => pack.mode === "dark").length;

    act(() => {
      [...document.querySelectorAll<HTMLButtonElement>("button")]
        .find((el) => el.textContent === "Dark")!
        .click();
    });
    expect(cards()).toHaveLength(darkCount);

    act(() => {
      [...document.querySelectorAll<HTMLButtonElement>("button")]
        .find((el) => el.textContent === "All")!
        .click();
    });
    expect(cards()).toHaveLength(PACK_COUNT);
    // The count readout follows the filter.
    expect(query('[aria-label="Theme gallery"]').textContent).toContain(
      `${PACK_COUNT} of ${PACK_COUNT} shown`,
    );
  });
});

describe("NewProjectRoute — finish sheet", () => {
  it("derives the slug preview live from the name field", () => {
    const { nameInput, query } = mount();
    expect(query("[data-slug-preview]").textContent).toBe("untitled");

    input(nameInput(), "Aurora Docs!");
    expect(query("[data-slug-preview]").textContent).toBe("aurora-docs");
  });

  it("creates with the selected pack + chosen mode and navigates to the server slug", async () => {
    const store = new MemoryProjectsDirectoryStore();
    const { cards, nameInput, createButton, navigate } = mount({ store });

    act(() => {
      cards()
        .find((el) => el.dataset.pack === "pack-4")!
        .click();
    });
    act(() => {
      [...document.querySelectorAll<HTMLButtonElement>("[data-mode]")]
        .find((el) => el.dataset.mode === "dark")!
        .click();
    });
    input(nameInput(), "My Docs");
    act(() => {
      createButton().click();
    });
    await settle();

    expect(navigate).toHaveBeenCalledWith({ name: "outline", projectSlug: "my-docs" });
    const created = await store.getProject("my-docs");
    expect(created.title).toBe("My Docs");
    expect(created.preset).toEqual({
      schemaVersion: 1,
      themePack: "pack-4",
      defaultMode: "dark",
    });
  });

  it("follows the server's deduped slug when the title is a duplicate", async () => {
    const store = new MemoryProjectsDirectoryStore({
      projects: [{ title: "My Docs" }],
    });
    const { nameInput, createButton, navigate } = mount({ store });

    input(nameInput(), "My Docs");
    act(() => {
      createButton().click();
    });
    await settle();

    // No duplicate-title error path — the create SUCCEEDS on the suffixed slug.
    expect(navigate).toHaveBeenCalledWith({
      name: "outline",
      projectSlug: "my-docs-2",
    });
  });

  it("disables Create while the name is empty", () => {
    const { nameInput, createButton } = mount();
    expect(createButton().disabled).toBe(true);
    input(nameInput(), "Docs");
    expect(createButton().disabled).toBe(false);
    input(nameInput(), "   ");
    expect(createButton().disabled).toBe(true);
  });

  it("shows an inline error when the create request fails", async () => {
    const failing: ProjectsDirectoryStore = {
      listProjects: () => Promise.resolve([]),
      getProject: () => Promise.reject(new Error("unused")),
      createProject: () =>
        Promise.reject(
          new StoreRequestError("network-error", "The editing server could not be reached.", 0),
        ),
      deleteProject: () => Promise.reject(new Error("unused")),
      duplicateProject: () => Promise.reject(new Error("unused")),
    };
    const { nameInput, createButton, navigate } = mount({ store: failing });

    input(nameInput(), "My Docs");
    act(() => {
      createButton().click();
    });
    await settle();

    expect(navigate).not.toHaveBeenCalled();
    const alert = document.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("could not be reached");
  });

  it("ignores Enter while an IME composition owns the key", async () => {
    const store = new MemoryProjectsDirectoryStore();
    const spy = vi.spyOn(store, "createProject");
    const { nameInput, navigate } = mount({ store });
    const field = nameInput();

    input(field, "ドキュメント");
    composition(field, "start");
    key(field, { key: "Enter", keyCode: 229 });
    await settle();
    expect(spy).not.toHaveBeenCalled();

    composition(field, "end");
    key(field, { key: "Enter" });
    await settle();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({
      name: "outline",
      projectSlug: "ドキュメント",
    });
  });

  it("returns to the dashboard on Escape, but never mid-composition", () => {
    const { navigate } = mount();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", isComposing: true }),
      );
    });
    expect(navigate).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(navigate).toHaveBeenCalledWith({ name: "projects" });
  });
});
