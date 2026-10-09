/** @vitest-environment happy-dom */

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { SEARCH_WIDGET_SCRIPT } from "../index.js";
import { AFTER_NAVIGATE_EVENT } from "../../transitions/page-events.js";

const SEARCH_INDEX = [
  {
    title: "Alpha guide",
    url: "/docs/alpha-guide",
    description: "A guide for alpha users.",
    body: "Alpha users can search this guide.",
  },
];

const originalUserAgent = Object.getOwnPropertyDescriptor(
  window.navigator,
  "userAgent",
);
const originalUserAgentData = Object.getOwnPropertyDescriptor(
  window.navigator,
  "userAgentData",
);

interface SearchWidgetFixture {
  host: HTMLElement;
  dialog: HTMLDialogElement;
  input: HTMLInputElement;
  results: HTMLElement;
  shortcut: () => HTMLElement;
  fetch: ReturnType<typeof vi.fn>;
}

function mountSearchWidget(platform: string): SearchWidgetFixture {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: platform === "macOS" ? "Macintosh" : "Windows NT 10.0",
  });
  Object.defineProperty(window.navigator, "userAgentData", {
    configurable: true,
    value: { platform },
  });

  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => SEARCH_INDEX,
  });
  vi.stubGlobal("fetch", fetch);

  document.body.innerHTML = "";
  const host = document.createElement("site-search") as HTMLElement;
  host.setAttribute("data-base", "/");
  host.setAttribute("data-result-count-template", "{count} results");
  host.setAttribute("data-search-unavailable", "Search unavailable");
  host.setAttribute("data-loading-index", "Loading search index…");
  host.setAttribute("data-no-results", "No results found.");
  host.innerHTML = `
      <button data-open-search type="button">Open search</button>
      <dialog data-search-dialog>
        <input data-search-input type="text" />
        <button data-close-search type="button">Close search</button>
        <span data-search-count></span>
        <span data-search-count-narrow></span>
        <div data-search-results>
          <div data-search-placeholder>
            <p>Search docs</p>
            <p><kbd data-kbd-shortcut></kbd> to open search from anywhere</p>
          </div>
        </div>
      </dialog>
  `;
  document.body.append(host);

  const dialog = host.querySelector<HTMLDialogElement>("[data-search-dialog]");
  const input = host.querySelector<HTMLInputElement>("[data-search-input]");
  const results = host.querySelector<HTMLElement>("[data-search-results]");
  if (
    !dialog ||
    !input ||
    !results ||
    !host.querySelector("[data-kbd-shortcut]")
  ) {
    throw new Error("search widget fixture is missing required elements");
  }

  const shortcut = (): HTMLElement => {
    const element = host.querySelector<HTMLElement>("[data-kbd-shortcut]");
    if (!element) throw new Error("search shortcut badge is missing");
    return element;
  };

  return { host, dialog, input, results, shortcut, fetch };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function enterQuery(
  fixture: SearchWidgetFixture,
  query: string,
): Promise<void> {
  fixture.input.value = query;
  fixture.input.dispatchEvent(new Event("input", { bubbles: true }));
  await vi.advanceTimersByTimeAsync(150);
  await flushMicrotasks();
}

beforeAll(() => {
  // Execute the exact generated script shipped to consumers in this DOM realm.
  window.eval(SEARCH_WIDGET_SCRIPT);
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalUserAgent) {
    Object.defineProperty(window.navigator, "userAgent", originalUserAgent);
  } else {
    Reflect.deleteProperty(window.navigator, "userAgent");
  }
  if (originalUserAgentData) {
    Object.defineProperty(
      window.navigator,
      "userAgentData",
      originalUserAgentData,
    );
  } else {
    Reflect.deleteProperty(window.navigator, "userAgentData");
  }
});

describe("search widget shortcut placeholder lifecycle", () => {
  it.each([
    { platform: "macOS", shortcut: "⌘K", modifier: "metaKey" as const },
    { platform: "Windows", shortcut: "Ctrl+K", modifier: "ctrlKey" as const },
  ])(
    "$platform keeps its shortcut through query clears, navigation, and reconnection",
    async ({ platform, shortcut, modifier }) => {
      const addListener = vi.spyOn(document, "addEventListener");
      const removeListener = vi.spyOn(document, "removeEventListener");
      const fixture = mountSearchWidget(platform);
      const openButton = fixture.host.querySelector<HTMLButtonElement>(
        "[data-open-search]",
      );
      const closeButton = fixture.host.querySelector<HTMLButtonElement>(
        "[data-close-search]",
      );
      if (!openButton || !closeButton) throw new Error("search buttons missing");

      expect(fixture.shortcut().textContent).toBe(shortcut);
      openButton.click();
      await flushMicrotasks();
      expect(fixture.dialog.open).toBe(true);

      await enterQuery(fixture, "alpha");
      expect(fixture.results.querySelector("article a")?.getAttribute("href")).toBe(
        "/docs/alpha-guide",
      );

      // Reconnecting while results replace the placeholder must not recapture
      // the results as the empty-query snapshot.
      fixture.host.remove();
      document.body.append(fixture.host);
      expect(fixture.results.querySelector("article a")).not.toBeNull();
      await enterQuery(fixture, "");
      expect(fixture.results.querySelector("[data-search-placeholder]")).not.toBeNull();
      expect(fixture.shortcut().textContent).toBe(shortcut);

      // Deleting the query restores the initial empty-state HTML snapshot.
      await enterQuery(fixture, "alpha");
      await enterQuery(fixture, "");
      expect(fixture.shortcut().textContent).toBe(shortcut);

      // The after-navigation handler re-applies the active platform label.
      document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
      expect(fixture.shortcut().textContent).toBe(shortcut);

      closeButton.click();
      expect(fixture.dialog.open).toBe(false);
      openButton.click();
      await flushMicrotasks();
      expect(fixture.dialog.open).toBe(true);
      expect(fixture.shortcut().textContent).toBe(shortcut);

      // Clicking a result closes the dialog while leaving its link available
      // for the browser's normal navigation handler.
      await enterQuery(fixture, "alpha");
      const resultLink = fixture.results.querySelector<HTMLAnchorElement>(
        "article a",
      );
      if (!resultLink) throw new Error("matching search result did not render");
      resultLink.addEventListener("click", (event) => event.preventDefault(), {
        once: true,
      });
      resultLink.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(fixture.dialog.open).toBe(false);
      await enterQuery(fixture, "");
      expect(fixture.shortcut().textContent).toBe(shortcut);

      const keyboardHandler = addListener.mock.calls.find(
        ([type]) => type === "keydown",
      )?.[1];
      const afterNavigateHandler = addListener.mock.calls.find(
        ([type]) => type === AFTER_NAVIGATE_EVENT,
      )?.[1];
      expect(keyboardHandler).toBeTypeOf("function");
      expect(afterNavigateHandler).toBeTypeOf("function");

      const openDialog = vi.spyOn(
        fixture.host as HTMLElement & { openDialog(): void },
        "openDialog",
      );
      fixture.host.remove();
      expect(removeListener).toHaveBeenCalledWith("keydown", keyboardHandler);
      expect(removeListener).toHaveBeenCalledWith(
        AFTER_NAVIGATE_EVENT,
        afterNavigateHandler,
      );

      document.body.append(fixture.host);
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          bubbles: true,
          [modifier]: true,
        }),
      );
      expect(openDialog).toHaveBeenCalledTimes(1);
      expect(fixture.dialog.open).toBe(true);

      document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
      expect(fixture.shortcut().textContent).toBe(shortcut);
    },
  );

  it("keeps loading, unavailable, and no-results states intact", async () => {
    let rejectFetch: ((reason: Error) => void) | undefined;
    const pendingFetch = new Promise((_resolve, reject) => {
      rejectFetch = reject;
    });
    const fixture = mountSearchWidget("Windows");
    fixture.fetch.mockReturnValue(pendingFetch);

    fixture.host.querySelector<HTMLButtonElement>("[data-open-search]")?.click();
    await enterQuery(fixture, "alpha");
    expect(fixture.results.textContent).toContain("Loading search index…");

    rejectFetch?.(new Error("offline"));
    await flushMicrotasks();
    expect(fixture.results.textContent).toContain("Search unavailable");
    await enterQuery(fixture, "alpha again");
    expect(fixture.results.textContent).toContain("Search unavailable");
    expect(fixture.fetch).toHaveBeenCalledTimes(1);

    const recovered = mountSearchWidget("Windows");
    recovered.host.querySelector<HTMLButtonElement>("[data-open-search]")?.click();
    await flushMicrotasks();
    await enterQuery(recovered, "missing");
    expect(recovered.results.textContent).toContain("No results found.");
  });
});
