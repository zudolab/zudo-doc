/** @jsxRuntime automatic */
// JSX port of src/components/version-switcher.
//
// Like the language-switcher, this is a pure presentational component:
// every URL, label, and availability flag the host project would derive
// from `settings.versions`, `t()`, and the version-availability map is
// passed in as a prop. The v2 package itself stays free of any
// settings/i18n/utils coupling.
//
// The Astro version shipped a `<script>` in the same file that wired up
// click-toggle / outside-click / Escape-key behavior on every
// `[data-version-switcher]` instance, idempotently re-binding after the
// page-navigate-end event. After zudolab/zudo-doc#1335 (E2 task 2 half
// B) that event resolves through the `AFTER_NAVIGATE_EVENT` constant in
// `transitions/page-events.ts` rather than a hard-coded `astro:*`
// literal. The JSX port emits the same data-attributes and markup, but
// the script lives separately as `VERSION_SWITCHER_INIT_SCRIPT` so
// consumers mount it once at body-end (matching how
// color-scheme-provider's bootstrap is structured). That keeps the
// component itself SSR-safe and side-effect-free, while letting the host
// page wire up exactly one global listener regardless of how many
// switchers are on the page.
//
// Astro → JSX deltas:
//   * `Astro.props` → typed `VersionSwitcherProps`.
//   * `class:list={[...]}` → manual class concatenation in `cls(...)`.
//   * `aria-current={isLatest ? "page" : undefined}` is preserved verbatim
//     (Preact omits the attribute when the value is `undefined`).
//   * The `<svg>` chevron stays inline so consumers don't need to import
//     an icon library.
//   * The `<script>` block in the source file is hoisted out into the
//     exported `VERSION_SWITCHER_INIT_SCRIPT` constant.
//
// Responsive visibility — now lives in consumer CSS (zudolab/zudo-doc#1505):
//   The host's <Header> wraps this component in `<div class="hidden lg:block">`
//   so the switcher only appears at lg+ viewports. That works as long as
//   Tailwind's content scanner has actually generated `.lg:block` and `.hidden`
//   rules in the bundled CSS. In some build setups (notably the e2e versioning
//   fixture) `.hidden` is generated but `.lg:block` is not, because Tailwind's
//   filesystem walk reaches `pages/` (where `.hidden`/`.block` are referenced
//   directly) but not the workspace-package source where `lg:block` lives.
//   The wrapper would then resolve to a permanent `display: none` even on
//   desktop and the switcher would disappear at every viewport.
//
//   Originally (Wave 11) the component emitted a small inline `<style>` child
//   inside the `<div data-version-switcher>` to add the missing desktop
//   override. That broke HTML5's content model — `<style>` is not permitted
//   as a child of flow content like `<div>` (zudolab/zudo-doc#1505). The fix
//   moved the rule out of the component and into the consumer's `global.css`
//   directly. The exported `VERSION_SWITCHER_VISIBILITY_STYLE` constant
//   remains as a re-usable string of the canonical CSS so downstream
//   consumers can verify or copy it into their own stylesheet.
//
//   Required CSS rule on any consumer that uses <VersionSwitcher>:
//
//     @media (min-width: 64rem) {
//       .hidden:has(> [data-version-switcher]) { display: block; }
//     }
//
//   - zudolab/zudo-doc carries this rule in `src/styles/global.css`.
//   - `create-zudo-doc` scaffolds it into the generated `src/styles/global.css`
//     template so freshly-scaffolded projects get it without action.

import type { Child } from "@takazudo/zfb/zudo-react";
import type { VersionEntry, VersionSwitcherLabels } from "./types.js";
import { AFTER_NAVIGATE_EVENT } from "../transitions/page-events.js";

export interface VersionSwitcherProps {
  /**
   * All known versions, in display order (latest at top of the dropdown
   * is rendered separately via `latestUrl` — this list is the
   * non-latest versions only).
   */
  versions: VersionEntry[];

  /** Current version slug, or undefined when the page is on "latest". */
  currentVersion?: string;

  /** Pre-resolved href for the "Latest" entry. */
  latestUrl: string;

  /** Pre-resolved href for the "All versions" footer link. */
  versionsPageUrl: string;

  /**
   * Map of `version slug` → pre-resolved href to that version of the
   * current page (or the versions index page when no slug is in scope).
   * Pass an empty object when the current page is not a versionable doc.
   */
  versionUrls: Record<string, string>;

  /**
   * Slugs of versions where the current page is NOT available. Renders
   * those entries as muted, non-interactive links with the
   * `unavailable` title attribute. Omit (or pass `undefined`) when no
   * availability data is in scope — every entry is then treated as
   * available, matching the Astro template's `!availability` branch.
   */
  unavailableVersions?: ReadonlySet<string>;

  /** UI strings — see `VersionSwitcherLabels` for the field list. */
  labels: VersionSwitcherLabels;

  /**
   * Optional suffix appended to the menu's DOM id. Used when more than
   * one version-switcher is rendered on the same page (e.g. one in the
   * header, one in the sidebar) so each `aria-controls` reference stays
   * unique.
   */
  idSuffix?: string;

  /**
   * When provided, the switcher container emits `data-version-rewire` plus its
   * config as `data-*`, and the menu anchors / trigger label carry the marker
   * attributes {@link VERSION_SWITCHER_REWIRE_SCRIPT} needs. This lets the
   * script recompute the per-page menu hrefs + active state + trigger label
   * from the live pathname after a same-locale SPA navigation — the header is
   * persisted (`data-zfb-transition-persist="header-${lang}"`), so its SSR menu
   * values would otherwise go stale (zudolab/zudo-doc#2553).
   *
   * Omit for a static / no-JS render, e.g. the inline breadcrumb switcher,
   * which lives in swapped content and is re-rendered fresh on every swap.
   */
  rewireConfig?: VersionSwitcherRewireConfig;
}

import type { VersionSwitcherRewireConfig } from "./switcher-url-state.js";
export { computeVersionSwitcherState, type VersionSwitcherRewireConfig, type VersionSwitcherState } from "./switcher-url-state.js";

/** Concatenate Tailwind class strings, dropping falsy entries. */
function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Canonical CSS rule that backs the responsive visibility of the
 * version-switcher's host wrapper. **The component itself does NOT
 * emit a `<style>` carrying this rule** — it lives in the consumer's
 * global stylesheet to avoid HTML5's `<style>`-as-flow-content
 * violation (zudolab/zudo-doc#1505). This export remains as a
 * re-usable canonical string so downstream consumers can drop the
 * rule into their own `global.css` verbatim or assert against it.
 *
 * The selector `.hidden:has(> [data-version-switcher])` keys off the
 * host header's `<div class="hidden lg:block">` baseline (the `.hidden`
 * part is always generated by Tailwind because `pages/` directly
 * references it) and only adds the *desktop* override at viewports
 * `>= 64rem`. Below 64rem there is no rule, so visibility falls
 * through to Tailwind's `.hidden` rule — mobile stays hidden the way
 * the host requested.
 *
 * Why scope to `.hidden`: a consumer that wraps `<VersionSwitcher>` in
 * something *without* the `.hidden` baseline (a flex row, a grid cell, an
 * unstyled span) is not asking for "hide on mobile, show on desktop" and
 * shouldn't have this rule rewrite its parent's `display`. Pinning the
 * selector to the `.hidden` precondition keeps the override surgical to
 * the documented usage pattern.
 *
 * The breakpoint (`64rem` = 1024px) intentionally mirrors the project's
 * Tailwind `lg` token. If the design system's `lg` boundary moves, update
 * this value to match.
 *
 * Specificity: `.hidden:has(> [data-version-switcher])` resolves to 0,0,2,0
 * — higher than Tailwind's `.hidden` (0,0,1,0). The unlayered author origin
 * also wins over `@layer utilities` regardless of specificity, so this rule
 * reliably overrides the wrapper's `display: none` at `>= 64rem`.
 */
export const VERSION_SWITCHER_VISIBILITY_STYLE =
  "@media (min-width:64rem){.hidden:has(> [data-version-switcher]){display:block}}";

function ChevronDownIcon(): Child {
  return (
    <svg
      class="h-[0.875rem] w-[0.875rem]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

/**
 * Drop-down version switcher rendered in the header.
 *
 * The toggle / outside-click / Escape-key behavior lives in
 * `VERSION_SWITCHER_INIT_SCRIPT` — mount it once at body-end on any
 * page that includes a `<VersionSwitcher>`.
 */
export function VersionSwitcher(props: VersionSwitcherProps): Child {
  const {
    versions,
    currentVersion,
    latestUrl,
    versionsPageUrl,
    versionUrls,
    unavailableVersions,
    labels,
    idSuffix = "",
    rewireConfig,
  } = props;

  const menuId = `version-menu${idSuffix ? `-${idSuffix}` : ""}`;
  const isLatest = !currentVersion;
  const triggerLabel = isLatest
    ? labels.latest
    : (versions.find((v) => v.slug === currentVersion)?.label ?? currentVersion);

  // Config attributes + anchor markers drive the SPA re-wire script; omitted
  // when no config is supplied so static / inline callers render exactly as
  // before (zudolab/zudo-doc#2553).
  const rewire = rewireConfig != null;
  // `labels.unavailable` rides on the container alongside the rest of the
  // rewire config rather than as a `VersionSwitcherRewireConfig` field —
  // `labels` is already a required prop the component always has in hand,
  // so this avoids widening the frozen public `VersionSwitcherRewireConfig`
  // shape with a field every existing caller would need to add (#3244
  // codex review finding).
  const rewireAttrs = rewireConfig
    ? {
        "data-version-rewire": true,
        "data-base": rewireConfig.base,
        "data-default-locale": rewireConfig.defaultLocale,
        "data-trailing-slash": String(rewireConfig.trailingSlash),
        "data-current-locale": rewireConfig.currentLocale,
        "data-unavailable-label": labels.unavailable,
      }
    : {};

  return (
    <div class="relative" data-version-switcher {...rewireAttrs}>
      <button
        type="button"
        class="flex items-center gap-hsp-2xs border border-muted rounded px-hsp-sm py-vsp-3xs text-small text-muted hover:border-accent hover:text-accent transition-colors cursor-pointer whitespace-nowrap"
        aria-expanded="false"
        aria-controls={menuId}
        data-version-toggle
      >
        <span class="text-caption">{labels.switcher}:</span>
        <span
          class="font-medium"
          data-version-trigger-label={rewire ? true : undefined}
        >
          {triggerLabel}
        </span>
        <ChevronDownIcon />
      </button>

      <ul
        id={menuId}
        class="absolute right-0 top-full z-dropdown mt-vsp-3xs hidden min-w-[8rem] border border-muted rounded bg-surface shadow-lg whitespace-nowrap py-vsp-3xs"
        data-version-menu
      >
        <li>
          <a
            href={latestUrl}
            aria-current={isLatest ? "page" : undefined}
            class={cls(
              "block px-hsp-md py-vsp-2xs text-small hover:bg-accent/10 hover:underline focus-visible:underline",
              isLatest ? "font-bold text-accent" : "text-fg",
            )}
            data-version-latest={rewire ? true : undefined}
          >
            {labels.latest}
          </a>
        </li>
        {versions.map((v) => {
          const vUrl = versionUrls[v.slug] ?? versionsPageUrl;
          const isActive = currentVersion === v.slug;
          // The Astro source treated "no availability info" as
          // "everything available" (`!availability || (...has(slug))`).
          // We mirror that: when the consumer doesn't pass
          // `unavailableVersions`, treat every entry as available.
          const isAvailable = !unavailableVersions || !unavailableVersions.has(v.slug);
          return (
            <li key={v.slug}>
              {isAvailable ? (
                <a
                  href={vUrl}
                  aria-current={isActive ? "page" : undefined}
                  class={cls(
                    "block px-hsp-md py-vsp-2xs text-small hover:bg-accent/10 hover:underline focus-visible:underline",
                    isActive ? "font-bold text-accent" : "text-fg",
                  )}
                  data-version-slug={rewire ? v.slug : undefined}
                >
                  {v.label}
                </a>
              ) : (
                <a
                  href={vUrl}
                  aria-disabled="true"
                  tabindex={-1}
                  class="block px-hsp-md py-vsp-2xs text-small text-muted/50 cursor-not-allowed pointer-events-none"
                  title={labels.unavailable}
                  data-version-slug={rewire ? v.slug : undefined}
                >
                  {v.label}
                </a>
              )}
            </li>
          );
        })}
        <li class="border-t border-muted">
          <a
            href={versionsPageUrl}
            class="block px-hsp-md py-vsp-2xs text-small text-muted hover:bg-accent/10 hover:text-fg hover:underline focus-visible:underline"
          >
            {labels.allVersions}
          </a>
        </li>
      </ul>
    </div>
  );
}

/**
 * Self-contained init script for the version-switcher's interactive
 * behavior. Mount once per page (e.g. inside the layout's body-end
 * scripts slot) — it idempotently re-binds via an AbortController so
 * multiple switchers on the page share a single event-listener
 * generation.
 *
 * The post-navigation rebinder uses `AFTER_NAVIGATE_EVENT` from
 * `transitions/page-events.ts` (today: `zfb:after-swap`) rather than
 * a hard-coded `astro:*` literal — see that module's header for the
 * full vocabulary rationale.
 *
 * Lifted from the `<script>` block of the original
 * version-switcher; behaviour is unchanged modulo the lifecycle
 * vocabulary swap.
 */
export const VERSION_SWITCHER_INIT_SCRIPT = `(function(){
var cleanupController=null;
function initVersionSwitcher(){
if(cleanupController)cleanupController.abort();
cleanupController=new AbortController();
var signal=cleanupController.signal;
document.querySelectorAll("[data-version-switcher]").forEach(function(switcher){
var toggle=switcher.querySelector("[data-version-toggle]");
var menu=switcher.querySelector("[data-version-menu]");
if(!toggle||!menu)return;
toggle.addEventListener("click",function(){
var isOpen=!menu.classList.contains("hidden");
menu.classList.toggle("hidden",isOpen);
toggle.setAttribute("aria-expanded",String(!isOpen));
},{signal:signal});
document.addEventListener("click",function(e){
if(!switcher.contains(e.target)){
menu.classList.add("hidden");
toggle.setAttribute("aria-expanded","false");
}
},{signal:signal});
document.addEventListener("keydown",function(e){
if(e.key==="Escape"&&!menu.classList.contains("hidden")){
menu.classList.add("hidden");
toggle.setAttribute("aria-expanded","false");
toggle.focus();
}
},{signal:signal});
});
}
initVersionSwitcher();
document.addEventListener(${JSON.stringify(AFTER_NAVIGATE_EVENT)},initVersionSwitcher);
})();`;

/**
 * Inline script that keeps the switcher's per-page menu correct inside a
 * persisted header. Mounted once wherever a header renders a re-wireable
 * VersionSwitcher (see `header.tsx`, gated on `hasVersions`), it recomputes each
 * menu anchor's href, the active row, and the trigger label from the live
 * pathname on first load and on `zfb:after-swap` — the same rebind-on-navigate
 * contract `LANGUAGE_SWITCHER_INIT_SCRIPT` uses (zudolab/zudo-doc#2553).
 *
 * It only touches switchers carrying `data-version-rewire` (emitted when a
 * {@link VersionSwitcherRewireConfig} is passed), so the inline breadcrumb
 * switcher — re-rendered fresh on every swap — is left alone.
 *
 * Since #3244, `rewire()` also recomputes each version entry's
 * enabled/disabled state from the per-page availability payload #3243 emits
 * onto the swapped `<article>` (`UNAVAILABLE_VERSIONS_ATTR`, imported here
 * as `ATTR` — see `version-availability/index.ts` for the three-state
 * contract). The persisted header would otherwise keep showing whichever
 * entries were disabled/enabled on the PREVIOUS page after a same-locale SPA
 * navigation — the exact bug epic #3242 exists to fix.
 *
 * The three-state contract is preserved faithfully here (fixed after a P2
 * codex review finding on the original #3244 landing, which collapsed ABSENT
 * into EMPTY and re-enabled every entry — turning SSR-correct disabled links
 * into live 404s whenever a page renders through `createDocPageShell` without
 * an availability payload):
 *   - attribute ABSENT (`hasAvailabilityData` false) → no availability data
 *     for the destination page. `setDisabled` is never called for any entry;
 *     the SSR-rendered disabled/enabled state is left exactly as-is. Only the
 *     genuinely path-derived bits (href, active state on entries that are
 *     NOT currently disabled) are recomputed.
 *   - attribute present, value `""` → empty unavailable set, i.e. "everything
 *     available" — `setDisabled(a, false, …)` runs for every entry, matching
 *     the SSR component's own `!unavailableVersions || !unavailableVersions.has(slug)`
 *     fallback (`version-switcher.tsx`'s `isAvailable` check).
 *   - attribute present, `"a,b"` → those slugs disabled, the rest enabled.
 *
 * `setDisabled` and the `setActive` guard together transition ALL FIVE
 * SSR-divergent properties in both directions (`aria-disabled`, `tabindex`,
 * `title`, the disjoint class sets, `aria-current`) — see the case table in
 * `__tests__/version-switcher.test.tsx` that pins this against the real SSR
 * branches. `setActive` runs strictly AFTER `setDisabled` re-enables an
 * entry, so a newly-available active entry gets `aria-current="page"`
 * restored instead of silently staying without it. In the ABSENT branch,
 * where `setDisabled` never runs, `setActive` instead reads the anchor's
 * OWN current `aria-disabled` attribute directly (the only source of truth
 * left, since availability isn't being recomputed) and skips already-disabled
 * entries the same way.
 *
 * `window[FLAG]` makes it idempotent: the tag may re-execute on a hard reload or
 * a cross-locale header repaint, but the listener registers exactly once per
 * page lifetime.
 *
 * The pathname fed to `computeVersionSwitcherState` comes from the embedded
 * `readCurrentPath`, which prefers the `data-zd-current-path` override over
 * `location.pathname` — the same explicit current-route reader
 * `nav-overflow-script.ts` / `sidebar-tree-island` / `language-switcher.tsx`
 * use (zudolab/zudo-doc#3398, consolidated by #3408).
 */
export { VERSION_SWITCHER_REWIRE_SCRIPT } from "./switcher-generated-scripts.js";

// Re-export the data types so consumers can import everything they need
// from this single module.
export type { VersionEntry, VersionSwitcherLabels };
