/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// JSX port of src/components/version-switcher.astro.
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
//   * The `<script>` block in the .astro source is hoisted out into the
//     exported `VERSION_SWITCHER_INIT_SCRIPT` constant.
//
// Self-contained responsive visibility (Wave 11):
//   The host's <Header> wraps this component in `<div class="hidden lg:block">`
//   so the switcher only appears at lg+ viewports. That works as long as
//   Tailwind's content scanner has actually generated `.lg:block` and `.hidden`
//   rules in the bundled CSS. In some build setups (notably the e2e versioning
//   fixture) `.hidden` is generated but `.lg:block` is not, because Tailwind's
//   filesystem walk reaches `pages/` (where `.hidden`/`.block` are referenced
//   directly) but not the workspace-package source where `lg:block` lives.
//   The wrapper then resolves to a permanent `display: none` even on desktop
//   and the switcher disappears at every viewport.
//
//   Rather than depend on the host's Tailwind classes, this component emits a
//   small unlayered `<style>` block (`VERSION_SWITCHER_VISIBILITY_STYLE`) that
//   re-introduces the missing desktop override only. The selector is
//   `.hidden:has(> [data-version-switcher])` so it
//
//     * matches the host header's `<div class="hidden lg:block">` wrapper
//       (which always has `.hidden` whether or not `.lg:block` made it into
//       the bundle), and
//     * does NOT touch any consumer that wraps the switcher in something
//       without the Tailwind `.hidden` baseline — that wrapper isn't asking
//       for "hide on mobile, show on desktop" in the first place, so the
//       fix stays out of its way.
//
//   Because the rule is unlayered author CSS, it wins over Tailwind's
//   `.hidden` (which lives in `@layer utilities`), so visibility is correct
//   regardless of whether `.lg:block` survived content scanning. Mobile
//   visibility falls through to `.hidden`'s `display: none` baseline.
//
//   The `<style>` element is rendered as the first child INSIDE the
//   `<div data-version-switcher>` so that the migration-check
//   `strip-version-switcher.mjs` walker (which removes the entire
//   `<div data-version-switcher>` subtree) cleans the `<style>` up too —
//   keeping post-cutover migration parity comparisons free of a structural
//   delta on every versioned page.
//
//   zudolab/zudo-doc#1444 added @source "packages/zudo-doc-v2/src/**" to
//   zudo-doc's global.css so `.lg:block` is emitted in both main and E2E
//   fixture builds for that project. The inline style is kept here because
//   this package is a library: downstream projects scaffolded by
//   create-zudo-doc do NOT have `packages/zudo-doc-v2/src/**` locally and
//   their global.css template does not include that @source path. Removing
//   the inline style would silently break the version-switcher in all
//   downstream consumer projects.
//
//   Consumers that ship their own visibility CSS can pass
//   `disableInlineVisibilityStyle` to suppress the inline `<style>`.

import type { VNode } from "preact";
import type { VersionEntry, VersionSwitcherLabels } from "./types";
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
   * When true, suppress the inline `<style>` element that backs responsive
   * visibility (`VERSION_SWITCHER_VISIBILITY_STYLE`). Use this when the
   * host already ships its own visibility CSS — for example, a project
   * whose Tailwind content scanner reaches the workspace-package source
   * (via an explicit `@source` directive) so `.lg:block` makes it into
   * the bundle without the inline override, or a project that wraps the
   * switcher in a layout that uses a non-`.hidden` baseline (`hidden
   * lg:flex`, `hidden xl:block`, a custom breakpoint, etc.).
   *
   * Defaults to `false` (emit the inline style) so existing consumers
   * keep working without a code change.
   */
  disableInlineVisibilityStyle?: boolean;
}

/** Concatenate Tailwind class strings, dropping falsy entries. */
function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Inline stylesheet that backs the responsive visibility of the
 * version-switcher's host wrapper. The selector
 * `.hidden:has(> [data-version-switcher])` keys off the host header's
 * `<div class="hidden lg:block">` baseline (the `.hidden` part is always
 * generated by Tailwind because `pages/` directly references it) and only
 * adds the *desktop* override at viewports `>= 64rem`. Below 64rem there
 * is no rule, so visibility falls through to Tailwind's `.hidden` rule —
 * mobile stays hidden the way the host requested.
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

function ChevronDownIcon(): VNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
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
export function VersionSwitcher(props: VersionSwitcherProps): VNode {
  const {
    versions,
    currentVersion,
    latestUrl,
    versionsPageUrl,
    versionUrls,
    unavailableVersions,
    labels,
    idSuffix = "",
    disableInlineVisibilityStyle = false,
  } = props;

  const menuId = `version-menu${idSuffix ? `-${idSuffix}` : ""}`;
  const isLatest = !currentVersion;
  const triggerLabel = isLatest
    ? labels.latest
    : (versions.find((v) => v.slug === currentVersion)?.label ?? currentVersion);

  return (
    <div class="version-switcher relative" data-version-switcher>
      {/*
       * Inline visibility rule — see file header for rationale. The
       * `<style>` lives inside the `data-version-switcher` element so the
       * migration-check `strip-version-switcher.mjs` walker removes it
       * symmetrically with the rest of the switcher subtree. Multiple
       * version-switchers on the same page each emit one of these
       * blocks; the declarations are byte-identical so the duplication
       * is harmless.
       */}
      {!disableInlineVisibilityStyle && (
        <style dangerouslySetInnerHTML={{ __html: VERSION_SWITCHER_VISIBILITY_STYLE }} />
      )}
      <button
        type="button"
        class="flex items-center gap-hsp-2xs border border-muted rounded px-hsp-sm py-vsp-3xs text-small text-muted hover:border-accent hover:text-accent transition-colors cursor-pointer whitespace-nowrap"
        aria-expanded="false"
        aria-controls={menuId}
        data-version-toggle
      >
        <span class="text-caption">{labels.switcher}:</span>
        <span class="font-medium">{triggerLabel}</span>
        <ChevronDownIcon />
      </button>

      <ul
        id={menuId}
        class="absolute right-0 top-full z-10 mt-vsp-3xs hidden min-w-[8rem] border border-muted rounded bg-surface shadow-lg whitespace-nowrap py-vsp-3xs"
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
 * `transitions/page-events.ts` (today: `DOMContentLoaded`) rather than
 * a hard-coded `astro:*` literal — see that module's header for the
 * full vocabulary rationale.
 *
 * Lifted from the `<script>` block of the original
 * version-switcher.astro; behaviour is unchanged modulo the lifecycle
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

// Re-export the data types so consumers can import everything they need
// from this single module.
export type { VersionEntry, VersionSwitcherLabels };
