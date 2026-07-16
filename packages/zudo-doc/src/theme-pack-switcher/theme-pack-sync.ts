// Shared theme-pack state helpers — the `color-scheme-sync.ts` sibling for
// the theme-pack layer (ADR `docs/adr/theme-packs.md`, Decision 3 "Runtime
// swap algorithm"; epic Theme Core #2812, sub-issue #2822).
//
// `applyThemePack` is the single write path for the active theme pack: it
// performs the atomic dual-link await-load swap, persists the choice, and
// notifies every subscriber (switcher flyout, browse-all dialog, the zdtp
// design-token-panel bootstrap) via the `theme-pack-changed` window event.
// The event name, the localStorage key, the `data-theme-pack` html attribute,
// and the `data-zd-theme-pack-css` link marker are cross-package/e2e
// contracts — do not rename (ADR "Naming rule (hard)").
//
// This module is intentionally NOT marked "use client": zfb's island scanner
// registers every exported binding of a "use client" file as an island, and
// these helpers are plain functions, not components. They run in the browser
// only (called from switcher islands, the zdtp bootstrap, and unit tests).

/** Window event dispatched after a theme-pack switch commits (ADR Decision 3
 *  step 8). `detail` carries {@link ThemePackChangeDetail}. */
export const THEME_PACK_CHANGED_EVENT = "theme-pack-changed";

/** localStorage key persisting the user's chosen pack slug. */
export const THEME_PACK_STORAGE_KEY = "zudo-doc-theme-pack";

/** `<html>` attribute carrying the ACTIVE pack slug (always present on a
 *  theme-pack-enabled page, also for `"default"`). */
export const THEME_PACK_ATTR = "data-theme-pack";

/** Marker attribute of the ACTIVE pack's stylesheet `<link>` (id-free; this
 *  attribute is the canonical selector). Absent when the active pack is
 *  `"default"`. */
export const THEME_PACK_LINK_ATTR = "data-zd-theme-pack-css";

/** Marker attribute of an in-flight (not yet committed) pack stylesheet
 *  `<link>` appended by {@link applyThemePack} step 4a. */
export const THEME_PACK_LINK_LOADING_ATTR = "data-zd-theme-pack-css-loading";

/**
 * The reserved slug meaning "the stock zudo-doc look" — no pack stylesheet is
 * ever inserted for it. Literal parity with `DEFAULT_THEME_PACK_SLUG` in
 * `../theme-packs-registry/meta-schema.ts` is guarded by a unit test; the
 * constant is re-declared here (rather than imported) because `meta-schema.ts`
 * imports `zod`, which must stay out of client island bundles.
 */
export const DEFAULT_THEME_PACK_SLUG = "default";

/**
 * `window` global published by the theme-pack bootstrap script
 * (`buildThemePackBootstrap`, `../theme/theme-pack-provider.tsx`) on every
 * hard load, carrying the inlined enabled-pack registry this module validates
 * against and builds pack URLs from. A window global (same JS realm) survives
 * zfb's SPA soft-swaps, so it is readable whenever `applyThemePack` runs.
 * Absent ⇒ the page has no theme-pack bootstrap (feature inert) and
 * `applyThemePack` refuses to switch.
 */
export const THEME_PACK_RUNTIME_GLOBAL = "__zudoDocThemePacks";

/** Upper bound for a pack stylesheet's load await (ADR Decision 3 step 4b). */
const LOAD_TIMEOUT_MS = 10_000;

/** Shape of the {@link THEME_PACK_RUNTIME_GLOBAL} window global. */
export interface ThemePackRuntimeConfig {
  /** Resolved base prefix WITH trailing slash (`"/"`, `"/sub/"`). */
  base: string;
  /** Ordered `{ slug → meta.version }` map of the ENABLED packs. */
  packs: Record<string, string>;
  /** The build-configured pack slug (`settings.themePack`). */
  configured: string;
}

/** `detail` payload of the {@link THEME_PACK_CHANGED_EVENT} window event. */
export interface ThemePackChangeDetail {
  /** The newly committed pack slug. */
  pack: string;
  /** The previously active pack slug. */
  previous: string;
}

/**
 * Canonical pack-stylesheet URL (ADR Decision 2 URL scheme):
 * `{base}theme-packs/<slug>/pack.css?v=<version>`. `base` must carry its
 * trailing slash. The `?v=` query is the cache-busting handle driven by the
 * pack's `meta.json` version.
 */
export function buildPackCssUrl(base: string, slug: string, version: string): string {
  return `${base}theme-packs/${slug}/pack.css?v=${version}`;
}

function readRuntimeConfig(): ThemePackRuntimeConfig | null {
  const cfg = (window as unknown as Record<string, unknown>)[
    THEME_PACK_RUNTIME_GLOBAL
  ];
  if (cfg === null || typeof cfg !== "object") return null;
  return cfg as ThemePackRuntimeConfig;
}

/**
 * Read the ACTIVE theme pack from `<html data-theme-pack>`. Falls back to
 * `"default"` when the attribute is missing or empty (e.g. a page rendered
 * without the theme-pack feature).
 */
export function readThemePackFromDom(): string {
  const actual = document.documentElement.getAttribute(THEME_PACK_ATTR);
  return actual !== null && actual !== "" ? actual : DEFAULT_THEME_PACK_SLUG;
}

/** Await a link element's `load`, racing `error` and the 10s timeout. Must be
 *  called BEFORE the link is appended so no event can be missed. */
function awaitLinkLoad(link: HTMLLinkElement): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), LOAD_TIMEOUT_MS);
    link.addEventListener(
      "load",
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      { once: true },
    );
    link.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        resolve(false);
      },
      { once: true },
    );
  });
}

/**
 * Module-level race token (ADR Decision 3 step 3/5). Each `applyThemePack`
 * call takes `++seq`; after its await it aborts when a newer call superseded
 * it — last-write-wins, no orphan links, no intermediate-pack flash.
 */
let seq = 0;

/**
 * Apply `next` as the active theme pack — the ADR Decision 3 swap algorithm,
 * implemented step-for-step. Resolves `true` on commit (also when `next` is
 * already active), `false` on abort/failure.
 *
 * Atomicity: pack CSS is authored entirely under
 * `html[data-theme-pack="<slug>"]` scoping (ADR Decision 6), so during the
 * dual-link overlap window the incoming pack's rules are inert until the
 * single synchronous attribute flip at step 6a — no intermediate mixed-pack
 * frame regardless of link/cascade order.
 *
 * Failure semantics (step 4b): on stylesheet error or timeout the new link is
 * removed, the CURRENT pack stays fully intact, and neither the localStorage
 * key nor the `theme-pack-changed` event fires.
 */
export async function applyThemePack(next: string): Promise<boolean> {
  // 1. Validate against the enabled registry (from the bootstrap's inlined
  //    map) — unknown slugs are rejected, never trusted raw.
  const runtime = readRuntimeConfig();
  if (
    runtime === null ||
    !Object.prototype.hasOwnProperty.call(runtime.packs, next)
  ) {
    console.warn(
      `[zudo-doc] applyThemePack: unknown theme pack "${next}" — enabled packs: ${
        runtime === null
          ? "(no theme-pack bootstrap on this page)"
          : Object.keys(runtime.packs).join(", ") || "(none)"
      }.`,
    );
    return false;
  }

  // 2. No-op when already active — but still supersede any in-flight swap:
  //    "stay on the current pack" is itself the user's LATEST instruction.
  //    Without the bump, a still-loading earlier call would pass its step-5
  //    token check and commit the pack the user just cancelled (last-write-
  //    wins violation; review finding). The superseded call aborts at step 5
  //    (or in its failure branch) and removes its own loading link.
  const current = readThemePackFromDom();
  if (next === current) {
    seq++;
    return true;
  }

  // 3. Take the race token.
  const token = ++seq;

  // 4. Load the incoming stylesheet (skipped for "default" — the stock look
  //    has no pack.css by design, ADR Decision 1).
  let newLink: HTMLLinkElement | null = null;
  if (next !== DEFAULT_THEME_PACK_SLUG) {
    newLink = document.createElement("link");
    newLink.setAttribute("rel", "stylesheet");
    newLink.setAttribute(THEME_PACK_LINK_LOADING_ATTR, "");
    newLink.setAttribute(
      "href",
      buildPackCssUrl(runtime.base, next, runtime.packs[next] ?? ""),
    );
    const loading = awaitLinkLoad(newLink);
    // Append to <head> END — always after the main bundle stylesheet.
    document.head.appendChild(newLink);
    const loaded = await loading;
    if (!loaded) {
      newLink.remove();
      // A superseding call may have removed our link mid-flight (its commit
      // step 6b) — that is a plain last-write-wins abort, not a load failure,
      // so only warn when this call is still the latest.
      if (token === seq) {
        console.warn(
          `[zudo-doc] theme pack "${next}" stylesheet failed to load (error or ${
            LOAD_TIMEOUT_MS / 1000
          }s timeout) — keeping "${current}".`,
        );
      }
      return false;
    }
  }

  // 5. Superseded by a newer call while awaiting? Abort (last-write-wins).
  if (token !== seq) {
    newLink?.remove();
    return false;
  }

  // 6. COMMIT (synchronous — no await between these steps).
  document.documentElement.setAttribute(THEME_PACK_ATTR, next);
  const packLinks = document.querySelectorAll(
    `link[${THEME_PACK_LINK_ATTR}], link[${THEME_PACK_LINK_LOADING_ATTR}]`,
  );
  for (const el of Array.from(packLinks)) {
    if (el !== newLink) el.remove();
  }
  if (newLink !== null) {
    newLink.removeAttribute(THEME_PACK_LINK_LOADING_ATTR);
    newLink.setAttribute(THEME_PACK_LINK_ATTR, "");
  }

  // 7. Persist (best-effort — private mode / disabled storage must not throw).
  try {
    localStorage.setItem(THEME_PACK_STORAGE_KEY, next);
  } catch {
    /* storage unavailable — the in-page switch still applies */
  }

  // 8. Notify subscribers AFTER commit so every listener reads post-switch
  //    state (the zdtp bootstrap's reseed depends on this ordering).
  window.dispatchEvent(
    new CustomEvent<ThemePackChangeDetail>(THEME_PACK_CHANGED_EVENT, {
      detail: { pack: next, previous: current },
    }),
  );

  // 9. Done.
  return true;
}

/**
 * Subscribe to theme-pack changes. Returns an unsubscribe function (suitable
 * as a `useEffect` cleanup). Mirrors `subscribeColorSchemeChanged` — two
 * mounted switcher surfaces (flyout + dialog) stay in sync by re-reading
 * {@link readThemePackFromDom} when notified.
 */
export function subscribeThemePackChanged(listener: () => void): () => void {
  window.addEventListener(THEME_PACK_CHANGED_EVENT, listener);
  return () => window.removeEventListener(THEME_PACK_CHANGED_EVENT, listener);
}
