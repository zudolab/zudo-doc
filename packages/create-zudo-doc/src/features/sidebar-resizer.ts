import type { FeatureModule } from "../compose.js";

export const sidebarResizerFeature: FeatureModule = () => ({
  name: "sidebarResizer",
  injections: [
    {
      // Inline script: reads saved sidebar width from localStorage and applies
      // it before first paint (critical-path). Uses dangerouslySetInnerHTML
      // because JSX layouts do not have Astro's is:inline script bundling.
      file: "src/layouts/doc-layout.tsx",
      anchor: "{/* @slot:doc-layout:head-scripts */}",
      content: `    {settings.sidebarResizer && (
      <script dangerouslySetInnerHTML={{ __html: \`(function () {
  function applySidebarWidth() {
    try {
      var w = localStorage.getItem("zudo-doc-sidebar-width");
      if (w && !isNaN(Number(w))) document.documentElement.style.setProperty("--zd-sidebar-w", w + "px");
    } catch (e) {}
  }
  applySidebarWidth();
})();\` }} />
    )}`,
      position: "after",
    },
    {
      // Bundled initializer: calls initSidebarResizer() from the feature's
      // local script file. The script tag is processed by the build pipeline
      // (Vite / zfb) which resolves the @/ alias.
      file: "src/layouts/doc-layout.tsx",
      anchor: "{/* @slot:doc-layout:body-end-scripts */}",
      content: `    {settings.sidebarResizer && (
      <script type="module" dangerouslySetInnerHTML={{ __html: \`
        import { initSidebarResizer } from "@/scripts/sidebar-resizer";
        initSidebarResizer();
      \` }} />
    )}`,
      position: "after",
    },
  ],
});
