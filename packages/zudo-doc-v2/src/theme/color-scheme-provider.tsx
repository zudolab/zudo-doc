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

import {
  generateCssCustomProperties,
  generateLightDarkCssProperties,
} from "@/config/color-scheme-utils";
import { settings } from "@/config/settings";

interface ColorSchemeProviderProps {
  /** Optional override for tests; defaults to the project-level settings. */
  cssText?: string;
  colorModeOverride?: typeof settings.colorMode;
}

/** Bootstrap script for the light/dark mode (settings.colorMode set). */
function buildColorModeBootstrap(
  defaultMode: "light" | "dark",
  respectPrefersColorScheme: boolean,
): string {
  // Values are inlined as JSON literals so the script body is fully
  // self-contained and matches what `define:vars` produced in Astro.
  const dm = JSON.stringify(defaultMode);
  const rp = JSON.stringify(Boolean(respectPrefersColorScheme));
  return `(function(){
var defaultMode=${dm};
var respectPrefersColorScheme=${rp};
var STORAGE_KEY="zudo-doc-theme";
function getSystemMode(){return window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}
function applyTheme(mode){document.documentElement.setAttribute("data-theme",mode);document.documentElement.style.colorScheme=mode;}
function getEffectiveMode(choice){if(choice==="light"||choice==="dark")return choice;return respectPrefersColorScheme?getSystemMode():defaultMode;}
var stored=null;try{stored=localStorage.getItem(STORAGE_KEY);}catch(e){}
applyTheme(getEffectiveMode(stored));
document.addEventListener("astro:after-swap",function(){var s=null;try{s=localStorage.getItem(STORAGE_KEY);}catch(e){}applyTheme(getEffectiveMode(s));});
if(respectPrefersColorScheme){window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",function(){var s=null;try{s=localStorage.getItem(STORAGE_KEY);}catch(e){}if(!s)applyTheme(getSystemMode());});}
})();`;
}

/** Bootstrap script for the persisted-tweak path (no light/dark mode). */
const PERSISTED_TWEAK_BOOTSTRAP = `(function(){
function applyStoredScheme(){var css=localStorage.getItem("zudo-doc-color-scheme-css");if(!css)return;try{var pairs=JSON.parse(css);var root=document.documentElement;for(var i=0;i<pairs.length;i++){root.style.setProperty(pairs[i][0],pairs[i][1]);}}catch(e){localStorage.removeItem("zudo-doc-color-scheme-css");}}
applyStoredScheme();
document.addEventListener("astro:after-swap",applyStoredScheme);
})();`;

export default function ColorSchemeProvider(props: ColorSchemeProviderProps = {}) {
  const colorMode = props.colorModeOverride ?? settings.colorMode;
  const cssText =
    props.cssText ??
    (colorMode ? generateLightDarkCssProperties() : generateCssCustomProperties());

  const bootstrap = colorMode
    ? buildColorModeBootstrap(
        colorMode.defaultMode,
        Boolean(colorMode.respectPrefersColorScheme),
      )
    : PERSISTED_TWEAK_BOOTSTRAP;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssText }} />
      <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
    </>
  );
}
