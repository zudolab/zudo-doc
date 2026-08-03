import { test, expect } from "./fixtures";
import { spaClick } from "./nav-helpers";

/**
 * E2E regression guard for the persisted header's version switcher going
 * stale on same-locale SPA navigation (epic #3242, closing out #3215's
 * second-order bug).
 *
 * #3215 made the switcher render an archive entry as disabled when the
 * current slug has no counterpart in that version, instead of a dead link
 * into a 404. That is correct on initial render. But the header is
 * persisted across SPA navigation
 * (`data-zfb-transition-persist="header-${lang}"`), and until #3244 the
 * `zfb:after-swap` rewire script recomputed hrefs / active state / the
 * trigger label but NOT which entries are disabled — so after a same-locale
 * SPA hop the header could show:
 *   - an entry ENABLED that is actually unavailable on the new page → a
 *     clickable link straight into a 404 (the severe direction — a narrow
 *     reintroduction of the exact bug #3215 fixed);
 *   - an entry DISABLED that is actually available → a dead end that cannot
 *     be reached, including by keyboard (`tabindex="-1"` never cleared).
 *
 * WHY THIS MUST BE A REAL SPA-NAVIGATION TEST, NOT `page.goto()`:
 * A full page load re-renders the header from scratch via SSR, which always
 * computes the correct disabled set for whatever page it lands on — that is
 * true both before and after #3244. Asserting after a `page.goto()` (or a
 * hard reload) would therefore pass VACUOUSLY on the pre-#3244 code: the
 * bug only exists in the DOM the client-side swap leaves behind, never in a
 * freshly-rendered document. If a future maintainer "simplifies" the
 * navigation below into a `goto()`, this spec stops testing anything and
 * will keep passing even if the regression comes back. Every page whose
 * disabled-state is asserted below is reached via `spaClick` (dispatches a
 * real anchor click + waits for `zfb:after-swap`) — `page.goto()` is used
 * exactly once per test, only for the neutral landing page described next.
 *
 * WHY THE LANDING PAGE IS `/docs/guides` (NOT ONE OF THE TWO PAGES UNDER
 * TEST): two independent constraints ruled out landing directly on either
 * `getting-started` or `whats-new`.
 *   1. Sidebar scope: `getting-started` matches this fixture's single
 *      `headerNav` `categoryMatch`, so ITS sidebar is scoped to just that
 *      one entry — there is no in-page link to `whats-new` to click from
 *      there (confirmed against the built fixture's dist HTML). `guides`
 *      matches no `categoryMatch`, so its sidebar renders the full site
 *      tree, with real `<a>` links to both `getting-started` and
 *      `whats-new`.
 *   2. An UNRELATED first-paint race rules out landing on `whats-new` via
 *      `page.goto()` even for tests that don't care about #1:
 *      `VERSION_SWITCHER_REWIRE_SCRIPT` also runs once synchronously
 *      inline, at first paint, to cover the one case `zfb:after-swap`
 *      genuinely does not fire for — the very first page load (see
 *      `AFTER_NAVIGATE_EVENT`'s doc in `transitions/page-events.ts`). That
 *      inline `<script>` sits inside `<header>`, which the HTML parser
 *      reaches BEFORE `<article>` further down the document, so on a plain
 *      `page.goto()` of a page with unavailable versions, that first
 *      synchronous run reads no `data-doc-unavailable-versions` attribute
 *      yet (the article hasn't been parsed) and wrongly leaves every entry
 *      enabled — independent of, and outside the scope of, this epic's
 *      SPA-navigation bug (reported separately as a first-paint
 *      correctness bug in `VERSION_SWITCHER_REWIRE_SCRIPT`). Reaching
 *      `whats-new` via `spaClick` instead sidesteps that race entirely: by
 *      the time an `zfb:after-swap` listener runs, the incoming document
 *      (including its `<article>`) was already fully parsed off-screen
 *      before the atomic body swap. `guides` (which has no unavailable
 *      versions) is unaffected by that race either way, so it is safe to
 *      reach via `page.goto()`.
 *
 * `guides` is itself a shared slug (present in both latest and the 1.0
 * archive — see fixture data below), so landing there also gives each test
 * a clean, correctly-enabled starting point for the header entry.
 *
 * SELECTOR SAFETY — asserting the PERSISTED header, not the inline switcher:
 * Doc pages render a second version-switcher inline (afterBreadcrumb), which
 * is swapped-in fresh content re-rendered correctly on every navigation —
 * asserting against it would prove nothing about this bug class. Every
 * locator below is scoped to `getByRole("banner")` (the header landmark)
 * AND to `[data-version-slug]`, an attribute the inline switcher never
 * renders at all (it has no `rewireConfig`, so `data-version-slug` is
 * omitted entirely — see version-switcher.tsx's `rewire` flag) — so even a
 * markup change that dropped the banner-only assumption could not make this
 * spec silently start reading the inline instance.
 *
 * Fixture data (e2e/fixtures/versioning/src/content/):
 *   - `docs/getting-started` and `docs/guides` exist in BOTH latest and the
 *     1.0 archive (`docs-v1/getting-started`, `docs-v1/guides`) — "shared
 *     slugs", so the 1.0 entry is enabled on either.
 *   - `docs/whats-new` exists ONLY in latest — a "latest-only slug", so the
 *     1.0 entry is disabled there (the same fixture #3196's regression
 *     guard in versioning.spec.ts reads via static dist HTML).
 */

test.describe("Version switcher SPA-navigation availability guard (#3242)", () => {
  test.beforeEach(async ({ page }) => {
    // >=1024px so the header switcher's `lg:block` override is active
    // (matches the viewport every other version-switcher spec uses), and so
    // the desktop sidebar (source of the in-page links below) is present.
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("shared slug -> latest-only slug: header entry becomes disabled after SPA nav (severe direction, #3215 reintroduction)", async ({
    page,
  }) => {
    await page.goto("/docs/guides", { waitUntil: "load" });

    const headerEntry = page
      .getByRole("banner")
      .locator('[data-version-menu] a[data-version-slug="1.0"]');

    // Sanity check on the landing page: guides is a shared slug, so the
    // archive entry starts enabled.
    await expect(headerEntry).not.toHaveAttribute("aria-disabled");
    await expect(headerEntry).not.toHaveAttribute("tabindex");

    const navigated = await spaClick(page, "/docs/whats-new");
    expect(navigated).toBe(true);

    // whats-new has no 1.0 counterpart — the persisted header's entry MUST
    // flip to disabled, or it is a live link into a 404.
    await expect(headerEntry).toHaveAttribute("aria-disabled", "true");
    await expect(headerEntry).toHaveAttribute("tabindex", "-1");
  });

  test("latest-only slug -> shared slug: header entry becomes enabled and genuinely clickable after SPA nav", async ({
    page,
  }) => {
    // Land on the neutral full-tree page, then reach the latest-only page
    // via a real SPA hop — see the file-level comment for why both the
    // landing choice and the "no page.goto() on whats-new" rule matter.
    await page.goto("/docs/guides", { waitUntil: "load" });

    const headerSwitcher = page.getByRole("banner").locator("[data-version-switcher]");
    const toggle = headerSwitcher.locator("[data-version-toggle]");
    const headerEntry = headerSwitcher.locator('[data-version-menu] a[data-version-slug="1.0"]');

    const navigatedToDisabled = await spaClick(page, "/docs/whats-new");
    expect(navigatedToDisabled).toBe(true);

    // Sanity check on the intermediate state: whats-new has no 1.0
    // counterpart, so the archive entry must be disabled here (this is
    // itself the severe-direction assertion the other test covers
    // end-to-end).
    await expect(headerEntry).toHaveAttribute("aria-disabled", "true");
    await expect(headerEntry).toHaveAttribute("tabindex", "-1");

    const navigated = await spaClick(page, "/docs/getting-started");
    expect(navigated).toBe(true);

    // getting-started is shared — the entry must re-enable...
    await expect(headerEntry).not.toHaveAttribute("aria-disabled");
    // ...and NOT merely drop aria-disabled while staying keyboard-unreachable
    // (a half-transition that leaves tabindex="-1" is the milder failure
    // direction the epic calls out).
    await expect(headerEntry).not.toHaveAttribute("tabindex");

    // Prove it is genuinely usable, not just attribute-clean: open the real
    // dropdown and click through. If the class list weren't restored
    // alongside the attributes (e.g. `pointer-events-none` left on),
    // Playwright's actionability check on `.click()` would fail here even
    // though the attribute assertions above already passed.
    await toggle.click();
    await headerEntry.click();
    await page.waitForURL(/\/v\/1\.0\/docs\/getting-started\/?$/);
  });
});
