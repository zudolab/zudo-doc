// Layout-level JSX port of src/components/color-scheme-provider.astro.
//
// Renders the palette CSS custom properties on `:root` and the bootstrap
// inline script that applies the persisted theme (light/dark) before the
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
   * Active light/dark mode config, or `null` for the persisted-tweak
   * bootstrap path (no light/dark; the in-browser tweak panel may inject
   * custom CSS vars from localStorage instead).
   */
  colorMode: ColorSchemeProviderColorMode | null;
  /** Optional children; preserved for forward compatibility. */
  children?: ComponentChildren;
}

/** Bootstrap script for the light/dark mode (settings.colorMode set). */
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
  return `(function(){
var defaultMode=${dm};
var respectPrefersColorScheme=${rp};
var STORAGE_KEY="zudo-doc-theme";
function getSystemMode(){return window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}
function applyTheme(mode){document.documentElement.setAttribute("data-theme",mode);document.documentElement.style.colorScheme=mode;}
function getEffectiveMode(choice){if(choice==="light"||choice==="dark")return choice;return respectPrefersColorScheme?getSystemMode():defaultMode;}
var stored=null;try{stored=localStorage.getItem(STORAGE_KEY);}catch(e){}
applyTheme(getEffectiveMode(stored));
document.addEventListener(${afterNav},function(){var s=null;try{s=localStorage.getItem(STORAGE_KEY);}catch(e){}applyTheme(getEffectiveMode(s));});
if(respectPrefersColorScheme){window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",function(){var s=null;try{s=localStorage.getItem(STORAGE_KEY);}catch(e){}if(!s)applyTheme(getSystemMode());});}
})();`;
}

/**
 * Bootstrap script for the persisted-tweak path (no light/dark mode).
 *
 * Built lazily so the `AFTER_NAVIGATE_EVENT` constant from
 * `transitions/page-events.ts` is interpolated into the script body
 * (zudolab/zudo-doc#1335 E2 task 2 half B). The previous module-scope
 * literal hard-coded `astro:after-swap`.
 */
function buildPersistedTweakBootstrap(): string {
  const afterNav = JSON.stringify(AFTER_NAVIGATE_EVENT);
  return `(function(){
function applyStoredScheme(){var css=localStorage.getItem("zudo-doc-color-scheme-css");if(!css)return;try{var pairs=JSON.parse(css);var root=document.documentElement;for(var i=0;i<pairs.length;i++){root.style.setProperty(pairs[i][0],pairs[i][1]);}}catch(e){localStorage.removeItem("zudo-doc-color-scheme-css");}}
applyStoredScheme();
document.addEventListener(${afterNav},applyStoredScheme);
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
    : buildPersistedTweakBootstrap();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssText }} />
      <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
    </>
  );
}
