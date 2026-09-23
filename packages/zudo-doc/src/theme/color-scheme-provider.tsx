// Layout-level JSX port of src/components/color-scheme-provider.
//
// Renders the palette CSS custom properties on `:root` and the bootstrap
// inline script that applies the persisted preference (light/dark/system) before the
// page paints. The component is intentionally server-rendered with no
// hydration: it just emits a <style> + <script> pair the engine streams
// into the document head. The Astro version used `set:text` and
// `define:vars`; the JSX equivalent is `dangerouslySetInnerHTML` with the
// runtime values interpolated as a JSON literal so the script can read
// them without re-fetching settings.
//
// W3B (#1730 — Generator Pages Migration): the consumer-side palette
// resolution and the host `settings.colorMode` lookup were lifted out of
// this component into the caller. The consumer (host wrapper) now
// pre-computes `cssText` via its own `generateCssCustomProperties()` /
// `generateLightDarkCssProperties()` helpers and passes both `cssText`
// and `colorMode` as required props, so this file no longer reaches into
// host `@/config/*` modules.

import type { ComponentChildren } from "preact";
import { AFTER_NAVIGATE_EVENT } from "../transitions/page-events.js";
import {
  COLOR_SCHEME_CHANGED_EVENT,
  COLOR_SCHEME_RUNTIME_GLOBAL,
  COLOR_SCHEME_STORAGE_KEY,
  normalizeThemePreference,
  resolveColorScheme,
  resolveThemePreference,
} from "../theme-toggle/color-scheme-sync.js";

/**
 * Subset of the host's `ColorModeConfig` that the v2 provider actually
 * consumes. Kept locally so the v2 package does not need to import a host
 * type module — the caller maps its own settings into this shape (or
 * passes `null` for the persisted-tweak / no-light-dark path).
 */
export interface ColorSchemeProviderColorMode {
  defaultMode: "light" | "dark";
  respectPrefersColorScheme: boolean;
}

export interface ColorSchemeProviderProps {
  /**
   * Pre-computed `:root { --zd-* }` CSS string. The caller resolves the
   * active color scheme (or the configured light+dark pair) and renders
   * the `<style>` body for us — this component just emits it.
   */
  cssText: string;
  /**
   * Active light/dark mode config, or `null` for a single fixed scheme. The
   * external design-token panel owns applying any persisted token overrides.
   */
  colorMode: ColorSchemeProviderColorMode | null;
  /** Optional children; preserved for forward compatibility. */
  children?: ComponentChildren;
}

/** Bootstrap script for the light/dark/system preference (settings.colorMode set). */
function buildColorModeBootstrap(
  defaultMode: "light" | "dark",
  respectPrefersColorScheme: boolean,
): string {
  // Values are inlined as JSON literals so the script body is fully
  // self-contained and matches what `define:vars` produced in Astro.
  // The post-navigation re-apply hook reads `AFTER_NAVIGATE_EVENT` from
  // `transitions/page-events.ts` rather than a hard-coded `astro:*`
  // literal — see zudolab/zudo-doc#1335 E2 task 2 half B.
  const dm = JSON.stringify(defaultMode);
  const rp = JSON.stringify(Boolean(respectPrefersColorScheme));
  const afterNav = JSON.stringify(AFTER_NAVIGATE_EVENT);
  const globalName = JSON.stringify(COLOR_SCHEME_RUNTIME_GLOBAL);
  const storageKey = JSON.stringify(COLOR_SCHEME_STORAGE_KEY);
  const modeEvent = JSON.stringify(COLOR_SCHEME_CHANGED_EVENT);
  return `(function(){
var defaultMode=${dm},respectPrefersColorScheme=${rp};
var STORAGE_KEY=${storageKey};
var normalizeThemePreference=${normalizeThemePreference.toString()};
var resolveThemePreference=${resolveThemePreference.toString()};
var resolveColorScheme=${resolveColorScheme.toString()};
var existing=window[${globalName}];
var state=existing||{choice:null,defaultMode:defaultMode,respectPrefersColorScheme:respectPrefersColorScheme};
if(existing&&existing.cleanup)existing.cleanup();
if(!existing){try{state.choice=normalizeThemePreference(localStorage.getItem(STORAGE_KEY));}catch(e){}}
state.defaultMode=defaultMode;
state.respectPrefersColorScheme=respectPrefersColorScheme;
window[${globalName}]=state;
var media=window.matchMedia("(prefers-color-scheme: dark)");
function applyTheme(){
  var preference=resolveThemePreference(state.choice,state.defaultMode,state.respectPrefersColorScheme);
  var mode=resolveColorScheme(preference,media.matches);
  var root=document.documentElement;
  var changed=(state.lastMode||root.getAttribute("data-theme"))!==mode;
  root.setAttribute("data-theme",mode);
  root.style.colorScheme=mode;
  state.lastMode=mode;
  if(changed)window.dispatchEvent(new CustomEvent(${modeEvent}));
}
function onNavigate(){applyTheme();}
function onMediaChange(){applyTheme();}
applyTheme();
document.addEventListener(${afterNav},onNavigate);
media.addEventListener("change",onMediaChange);
state.cleanup=function(){document.removeEventListener(${afterNav},onNavigate);media.removeEventListener("change",onMediaChange);};
})();`;
}

export default function ColorSchemeProvider({
  cssText,
  colorMode,
}: ColorSchemeProviderProps) {
  const bootstrap = colorMode
    ? buildColorModeBootstrap(
        colorMode.defaultMode,
        Boolean(colorMode.respectPrefersColorScheme),
      )
    : null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssText }} />
      {bootstrap !== null && <script dangerouslySetInnerHTML={{ __html: bootstrap }} />}
    </>
  );
}
