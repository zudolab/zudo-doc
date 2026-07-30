// ThemePackProvider — the FOUC-safe theme-pack bootstrap, sibling of
// `color-scheme-provider.tsx` (ADR `docs/adr/theme-packs.md`, Decision 3
// "Hard-load bootstrap"; epic Theme Core #2812, sub-issue #2822; soft-nav FOUC
// fix zudolab/zudo-doc#3136, sub-issue #3137).
//
// Rendered by `head-with-defaults` IMMEDIATELY AFTER `<ColorSchemeProvider/>`.
// Emits, in order:
//
//   1. An inline `<script>` that resolves the active pack slug
//      (validated localStorage value, else the configured slug) BEFORE first
//      paint, sets `<html data-theme-pack>`, and — for a non-default pack —
//      `document.write`s the single pack stylesheet link. The written link is
//      parser-inserted, therefore render-blocking in every browser: the one
//      mechanism with a hard cross-browser pre-paint guarantee AND exactly one
//      stylesheet request that is correct the first time (no default-then-
//      stored double fetch, no MutationObserver races). Chrome's
//      document.write intervention targets parser-blocking cross-origin
//      *scripts*, not stylesheets. There is deliberately NO eager SSR link —
//      an inline script cannot rewrite an SSR link's href "before the
//      request" (by the time the element is scriptable its fetch has started).
//   2. A `<noscript>` fallback link for the CONFIGURED pack (omitted when the
//      configured pack is `default`) so a no-JS visitor gets the configured
//      look, matching the SSR `data-theme-pack` html attribute.
//
// SPA soft navigation (zfb Strategy B) — PRIMARY mechanism is a
// `BEFORE_SWAP_EVENT` ("zfb:before-swap") listener. zfb dispatches this event
// with a mutable `event.newDocument` BEFORE it runs `swapHeadElements`, whose
// persistence rule keeps a live head `<link rel=stylesheet>` in place only
// when the INCOMING document's head already contains a stylesheet link with
// the exact same `href`. The incoming SSR head never carries the runtime pack
// link, so without this handler the swap always removes it. The handler
// re-resolves the active slug and, for a non-default pack whose href is not
// already present in `event.newDocument.head`, injects a matching
// `<link data-zd-theme-pack-css>` into `event.newDocument.head` via
// `createElement`/`appendChild` (mutating `newDocument`, never `document` —
// at this point `newDocument` is a separate, not-yet-live document). zfb's
// href-match then treats the LIVE link as persisted: it is spliced out of the
// swap and simply stays in the (already loaded, already applied) live head —
// zero removal, zero refetch, zero unstyled frame.
//
// The AFTER_NAVIGATE re-apply handler remains as FALLBACK / cleanup: it
// re-resolves the slug, re-asserts the html attribute, and — only if the pack
// link is somehow still missing after the swap (e.g. the before-swap handler
// didn't run, or a mismatch needs correcting) — re-inserts it via
// `createElement`/`appendChild`, and removes stale/wrong-slug links (including
// dropping the link entirely when the resolved slug is `default`). It also
// covers the default-pack case, which the before-swap handler intentionally
// skips (there is nothing to persist for `default`). Neither handler EVER
// uses `document.write` after load — that would clobber the live document.
// Slug resolution is stored-first (validated) per the ADR, with a validated
// LIVE `<html data-theme-pack>` fallback before the configured default:
// `data-theme-pack` rides `preserveHtmlAttrs`, so when persistence failed
// during a runtime switch (private mode / disabled storage) the user's
// in-session pack survives soft navigations instead of silently reverting
// (review finding). On hard load the live attribute is the SSR-rendered
// configured slug, so the fallback is behavior-identical there.
// The script's text is build-static and identical
// on every page, so zfb's already-executed-script dedupe
// (`scriptsAlreadyRan`, keyed on textContent) guarantees it runs exactly once
// per hard load — neither handler is ever double-registered.
//
// Values are inlined as JSON literals (mirroring `buildColorModeBootstrap`)
// so the script body is fully self-contained. It additionally publishes the
// inlined `{ base, packs, configured }` map as the
// `window.__zudoDocThemePacks` runtime global — the channel
// `theme-pack-sync.ts`'s `applyThemePack` validates slugs against and builds
// pack URLs from.

import type { JSX } from "preact";
import {
  AFTER_NAVIGATE_EVENT,
  BEFORE_SWAP_EVENT,
} from "../transitions/page-events.js";
import {
  DEFAULT_THEME_PACK_SLUG,
  THEME_PACK_ATTR,
  THEME_PACK_LINK_ATTR,
  THEME_PACK_RUNTIME_GLOBAL,
  THEME_PACK_STORAGE_KEY,
  buildPackCssUrl,
} from "../theme-pack-switcher/theme-pack-sync.js";
import type { ThemePackRegistry } from "../theme-packs-registry/index.js";

export interface ThemePackProviderProps {
  /** The build-configured pack slug (`settings.themePack`, default `"default"`). */
  configuredSlug: string;
  /**
   * Ordered `{ slug → meta.version }` map of the ENABLED packs — build with
   * {@link themePackVersionMap} from `ctx.themePackRegistry`. Order carries
   * the switcher order; versions drive the `?v=` cache-busting query.
   */
  enabled: Record<string, string>;
  /** Resolved base prefix WITH trailing slash (`ctx.withBase("/")`). */
  base: string;
}

/**
 * Build the ordered `{ slug → version }` map the bootstrap inlines from the
 * resolved, enabled, ordered registry (`ctx.themePackRegistry`).
 */
export function themePackVersionMap(
  registry: ThemePackRegistry,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of registry) {
    map[entry.slug] = entry.meta.version;
  }
  return map;
}

/**
 * The `data-theme-pack` value a page's `<html>` element must carry in SSR
 * output: the CONFIGURED pack slug (build-static, unlike the
 * user-preference-only `data-theme`) — this is what the no-JS path needs.
 * Returns `undefined` (attribute omitted, feature inert) when the registry
 * was not threaded (`themePackRegistry: null`, e.g. a
 * `packageOwnedRoutes: false` host that builds its own payload).
 */
export function resolveThemePackSsrSlug(
  registry: ThemePackRegistry | null,
  settings: { themePack?: string },
): string | undefined {
  if (registry === null) return undefined;
  return settings.themePack ?? DEFAULT_THEME_PACK_SLUG;
}

/**
 * Bootstrap script for the theme-pack layer. Values are inlined as JSON
 * literals so the script body is fully self-contained (the
 * `buildColorModeBootstrap` pattern).
 */
export function buildThemePackBootstrap(
  configuredSlug: string,
  enabled: Record<string, string>,
  base: string,
): string {
  const configured = JSON.stringify(configuredSlug);
  const packs = JSON.stringify(enabled);
  const b = JSON.stringify(base);
  const key = JSON.stringify(THEME_PACK_STORAGE_KEY);
  const attr = JSON.stringify(THEME_PACK_ATTR);
  const linkAttr = JSON.stringify(THEME_PACK_LINK_ATTR);
  const defaultSlug = JSON.stringify(DEFAULT_THEME_PACK_SLUG);
  const runtimeGlobal = JSON.stringify(THEME_PACK_RUNTIME_GLOBAL);
  const afterNav = JSON.stringify(AFTER_NAVIGATE_EVENT);
  const beforeSwap = JSON.stringify(BEFORE_SWAP_EVENT);
  return `(function(){
var configured=${configured};
var packs=${packs};
var base=${b};
var KEY=${key};
var ATTR=${attr};
var LINK_ATTR=${linkAttr};
var DEFAULT_SLUG=${defaultSlug};
function resolveSlug(){var stored=null;try{stored=localStorage.getItem(KEY);}catch(e){}if(stored&&Object.prototype.hasOwnProperty.call(packs,stored))return stored;var live=document.documentElement.getAttribute(ATTR);if(live&&Object.prototype.hasOwnProperty.call(packs,live))return live;return configured;}
function packHref(slug){return base+"theme-packs/"+slug+"/pack.css?v="+packs[slug];}
var slug=resolveSlug();
document.documentElement.setAttribute(ATTR,slug);
if(slug!==DEFAULT_SLUG){document.write('<link rel="stylesheet" '+LINK_ATTR+' href="'+packHref(slug)+'">');}
window[${runtimeGlobal}]={base:base,packs:packs,configured:configured};
document.addEventListener(${beforeSwap},function(e){
var s=resolveSlug();
if(s===DEFAULT_SLUG)return;
var nd=e.newDocument;
if(!nd||nd===document)return;
var want=packHref(s);
var links=nd.head.querySelectorAll("link");
for(var i=0;i<links.length;i++){var l=links[i];if(l.getAttribute("rel")==="stylesheet"&&l.getAttribute("href")===want)return;}
var nl=nd.createElement("link");
nl.setAttribute("rel","stylesheet");
nl.setAttribute(LINK_ATTR,"");
nl.setAttribute("href",want);
nd.head.appendChild(nl);
});
document.addEventListener(${afterNav},function(){
var s=resolveSlug();
document.documentElement.setAttribute(ATTR,s);
var links=document.querySelectorAll("link["+LINK_ATTR+"]");
var want=s===DEFAULT_SLUG?null:packHref(s);
var found=false;
for(var i=0;i<links.length;i++){var l=links[i];if(want!==null&&!found&&l.getAttribute("href")===want){found=true;}else if(l.parentNode){l.parentNode.removeChild(l);}}
if(want!==null&&!found){var nl=document.createElement("link");nl.setAttribute("rel","stylesheet");nl.setAttribute(LINK_ATTR,"");nl.setAttribute("href",want);document.head.appendChild(nl);}
});
})();`;
}

/**
 * Server-rendered head fragment: the pre-paint bootstrap `<script>` plus the
 * `<noscript>` configured-pack fallback. No hydration — like
 * `ColorSchemeProvider` it just emits markup the engine streams into `<head>`.
 */
export default function ThemePackProvider({
  configuredSlug,
  enabled,
  base,
}: ThemePackProviderProps): JSX.Element {
  const bootstrap = buildThemePackBootstrap(configuredSlug, enabled, base);
  const configuredVersion = enabled[configuredSlug];
  const noscriptHref =
    configuredSlug !== DEFAULT_THEME_PACK_SLUG && configuredVersion !== undefined
      ? buildPackCssUrl(base, configuredSlug, configuredVersion)
      : null;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
      {noscriptHref !== null && (
        <noscript>
          <link rel="stylesheet" href={noscriptHref} />
        </noscript>
      )}
    </>
  );
}
