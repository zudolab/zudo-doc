import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect } from "/workspace/zudo-doc/node_modules/@playwright/test/index.mjs";

const INITIAL_PATH = "/docs/guides/page-1/";
const TARGET_PATH = "/docs/guides/code-blocks-test";
const TARGET_PATH_WITH_SLASH = `${TARGET_PATH}/`;
const FILTER_VALUE = "Code Blocks Test";
const OUT_DIR = "/tmp/zudo421-runtime-probes/input-token";

function changedTopLevelKeys(before: Record<string, unknown>, after: Record<string, unknown>) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])).sort();
}

test("compare unchanged and changed nested-island props across same-document sidebar navigation", async ({ page }, testInfo) => {
  const documentRequests: string[] = [];
  let incomingHtmlPromise: Promise<string> | undefined;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.resourceType() === "document") {
      documentRequests.push(request.url());
    }
  });
  page.on("response", async (response) => {
    if (new URL(response.url()).pathname.replace(/\/$/, "") === TARGET_PATH && response.status() === 200) {
      incomingHtmlPromise = response.text();
    }
  });

  const response = await page.goto(INITIAL_PATH, { waitUntil: "load" });
  expect(response?.status()).toBe(200);
  const aside = page.locator("#desktop-sidebar");
  const filter = aside.locator('input[placeholder^="Filter"]');
  await expect(aside.locator("nav")).toBeAttached();
  await expect(filter).toBeVisible();
  await filter.fill(FILTER_VALUE);
  // SidebarTree's filtering is an observable hydration check: the route link
  // is server-rendered before JavaScript, so verify the controlled input state
  // and its resulting visible link before writing identity tokens.
  await expect(filter).toHaveValue(FILTER_VALUE);
  const targetLink = aside.locator(
    `a[href="${TARGET_PATH}"], a[href="${TARGET_PATH_WITH_SLASH}"]`,
  );
  await expect(targetLink).toBeVisible();
  const themeButton = page.locator(
    '[data-header] [data-zfb-island="ThemeToggle"] [data-zd-theme-menu] > button[aria-haspopup="menu"]',
  );
  // ThemeToggle is intentionally inert until its load island hydrates. Waiting
  // for both public pending markers to clear makes any subsequent node change
  // comparable across the pinned and migrated runtimes.
  await expect(themeButton).not.toHaveAttribute("aria-disabled", "true");
  await expect(themeButton).not.toHaveAttribute("data-zd-pending", "");

  const initial = await page.evaluate(() => {
    const aside = document.querySelector<HTMLElement>("#desktop-sidebar");
    const input = aside?.querySelector<HTMLInputElement>('input[placeholder^="Filter"]');
    const tree = aside?.querySelector<HTMLElement>('[data-zfb-island="SidebarTree"]');
    const headerTheme = document.querySelector<HTMLElement>(
      '[data-header] [data-zfb-island="ThemeToggle"]',
    );
    const themeButton = headerTheme?.querySelector<HTMLButtonElement>("button");
    if (!aside || !input || !tree || !headerTheme || !themeButton) {
      throw new Error("expected persisted sidebar tree and header ThemeToggle roots");
    }
    const token = `persist-probe-${Date.now()}-${Math.random()}`;
    (aside as HTMLElement & { __probeToken?: string }).__probeToken = token;
    (input as HTMLInputElement & { __probeToken?: string }).__probeToken = token;
    (tree as HTMLElement & { __probeToken?: string }).__probeToken = token;
    (headerTheme as HTMLElement & { __probeToken?: string }).__probeToken = token;
    (themeButton as HTMLButtonElement & { __probeToken?: string }).__probeToken = token;
    (window as Window & { __persistProbeDocumentToken?: string }).__persistProbeDocumentToken = token;
    const documentWithTransition = document as Document & {
      startViewTransition?: (callback?: () => void | Promise<void>) => { finished: Promise<unknown> };
    };
    if (typeof documentWithTransition.startViewTransition !== "function") {
      throw new Error("Chromium does not expose document.startViewTransition");
    }
    const original = documentWithTransition.startViewTransition.bind(documentWithTransition);
    const record: { calls: number; status: "pending" | "fulfilled" | "rejected"; error?: string } = {
      calls: 0,
      status: "pending",
    };
    (window as Window & { __persistProbeTransition?: typeof record }).__persistProbeTransition = record;
    documentWithTransition.startViewTransition = (callback) => {
      const transition = original(callback);
      record.calls++;
      void transition.finished.then(
        () => { record.status = "fulfilled"; },
        (error: unknown) => {
          record.status = "rejected";
          record.error = error instanceof Error ? error.message : String(error);
        },
      );
      return transition;
    };
    return {
      token,
      timeOrigin: performance.timeOrigin,
      asideProps: JSON.parse(tree.getAttribute("data-props") ?? "null"),
      themeProps: JSON.parse(headerTheme.getAttribute("data-props") ?? "null"),
      filterValue: input.value,
      themeButtonPending: themeButton.hasAttribute("data-zd-pending"),
      themeButtonAriaDisabled: themeButton.getAttribute("aria-disabled"),
      themeToken: token,
    };
  });
  const initialDocumentRequestCount = documentRequests.length;
  expect(initialDocumentRequestCount).toBeGreaterThanOrEqual(1);

  await page.evaluate((href) => {
    const anchor = [...document.querySelectorAll<HTMLAnchorElement>("#desktop-sidebar a[href]")]
      .find((candidate) => candidate.getAttribute("href")?.replace(/\/$/, "") === href);
    if (!anchor) throw new Error("filtered target link disappeared before SPA click");
    (window as Window & { __persistProbeSwap?: boolean }).__persistProbeSwap = false;
    document.addEventListener("zfb:after-swap", () => {
      (window as Window & { __persistProbeSwap?: boolean }).__persistProbeSwap = true;
    }, { once: true });
  }, TARGET_PATH);
  await targetLink.click();
  await page.waitForFunction(
    () => (window as Window & { __persistProbeSwap?: boolean }).__persistProbeSwap === true,
    undefined,
    { timeout: 10_000 },
  );
  await expect(page).toHaveURL(new RegExp("/docs/guides/code-blocks-test/?$"));
  await page.waitForFunction(
    () => (window as Window & { __persistProbeTransition?: { status: string } })
      .__persistProbeTransition?.status !== "pending",
    undefined,
    { timeout: 10_000 },
  );
  await expect(filter).toBeAttached();

  const after = await page.evaluate(() => {
    const aside = document.querySelector<HTMLElement>("#desktop-sidebar");
    const input = aside?.querySelector<HTMLInputElement>('input[placeholder^="Filter"]');
    const tree = aside?.querySelector<HTMLElement>('[data-zfb-island="SidebarTree"]');
    const headerTheme = document.querySelector<HTMLElement>(
      '[data-header] [data-zfb-island="ThemeToggle"]',
    );
    const themeButton = headerTheme?.querySelector<HTMLButtonElement>("button");
    return {
      timeOrigin: performance.timeOrigin,
      documentToken: (window as Window & { __persistProbeDocumentToken?: string }).__persistProbeDocumentToken,
      asideToken: (aside as (HTMLElement & { __probeToken?: string }) | null)?.__probeToken,
      inputToken: (input as (HTMLInputElement & { __probeToken?: string }) | null)?.__probeToken,
      treeToken: (tree as (HTMLElement & { __probeToken?: string }) | null)?.__probeToken,
      themeToken: (headerTheme as (HTMLElement & { __probeToken?: string }) | null)?.__probeToken,
      themeButtonToken: (themeButton as (HTMLButtonElement & { __probeToken?: string }) | null)?.__probeToken,
      filterValue: input?.value,
      ariaCurrent: [...(aside?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? [])]
        .find((anchor) => anchor.getAttribute("href")?.replace(/\/$/, "") === location.pathname.replace(/\/$/, ""))
        ?.getAttribute("aria-current"),
      props: tree ? JSON.parse(tree.getAttribute("data-props") ?? "null") : null,
      themeProps: headerTheme ? JSON.parse(headerTheme.getAttribute("data-props") ?? "null") : null,
      transition: (window as Window & { __persistProbeTransition?: unknown }).__persistProbeTransition,
    };
  });

  let incomingHtml: string | undefined;
  if (incomingHtmlPromise) incomingHtml = await incomingHtmlPromise;
  let incomingProps: Record<string, unknown> | null = null;
  let incomingThemeProps: Record<string, unknown> | null = null;
  if (incomingHtml) {
    const parsed = await page.evaluate((html) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const tree = doc.querySelector<HTMLElement>('#desktop-sidebar [data-zfb-island="SidebarTree"]');
      const theme = doc.querySelector<HTMLElement>('[data-header] [data-zfb-island="ThemeToggle"]');
      return {
        props: tree ? JSON.parse(tree.getAttribute("data-props") ?? "null") : null,
        themeProps: theme ? JSON.parse(theme.getAttribute("data-props") ?? "null") : null,
      };
    }, incomingHtml);
    incomingProps = parsed.props;
    incomingThemeProps = parsed.themeProps;
  }

  const report = {
    project: testInfo.project.name,
    initialPath: INITIAL_PATH,
    targetPath: TARGET_PATH,
    initialDocumentRequestCount,
    finalDocumentRequestCount: documentRequests.length,
    initial,
    after,
    incomingProps,
    incomingThemeProps,
    changedSidebarPropKeys: incomingProps
      ? changedTopLevelKeys(initial.asideProps as Record<string, unknown>, incomingProps)
      : null,
    unchangedThemeProps: incomingThemeProps
      ? JSON.stringify(initial.themeProps) === JSON.stringify(incomingThemeProps)
      : null,
    sameAside: after.asideToken === initial.token,
    sameInput: after.inputToken === initial.token,
    sameTreeRoot: after.treeToken === initial.token,
    sameThemeRoot: after.themeToken === initial.token,
    sameThemeButton: after.themeButtonToken === initial.token,
  };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/${testInfo.project.name}.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PERSISTED_SIDEBAR_CONTROL ${JSON.stringify(report)}`);

  expect(documentRequests).toHaveLength(initialDocumentRequestCount);
  expect(after.timeOrigin).toBe(initial.timeOrigin);
  expect(after.documentToken).toBe(initial.token);
  expect(after.asideToken).toBe(initial.token);
  expect(after.themeToken).toBe(initial.token);
  expect(after.themeButtonToken).toBe(initial.token);
  expect(report.unchangedThemeProps).toBe(true);
  expect(report.changedSidebarPropKeys).toEqual(["currentSlug"]);
  expect(after.ariaCurrent).toBe("page");
  if (testInfo.project.name === "v2-337b9f1") {
    expect(after.inputToken, "the frozen v2 control retains the filtered input node").toBe(initial.token);
    expect(after.filterValue).toBe(FILTER_VALUE);
  }
});
