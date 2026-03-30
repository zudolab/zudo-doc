import type { FeatureModule } from "../compose.js";

export const sidebarResizerFeature: FeatureModule = () => ({
  name: "sidebarResizer",
  files: ["src/scripts/sidebar-resizer.ts"],
  injections: [
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "<!-- @slot:doc-layout:head-scripts -->",
      content: `    {settings.sidebarResizer && (
      <script is:inline>
        (function () {
          function applySidebarWidth() {
            try {
              var w = localStorage.getItem("zudo-doc-sidebar-width");
              if (w && !isNaN(Number(w))) document.documentElement.style.setProperty("--zd-sidebar-w", w + "px");
            } catch (e) {}
          }
          applySidebarWidth();
          document.addEventListener("astro:after-swap", applySidebarWidth);
        })();
      </script>
    )}`,
      position: "after",
    },
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "<!-- @slot:doc-layout:body-end-scripts -->",
      content: `    {settings.sidebarResizer && (
      <script>
        import { initSidebarResizer } from "@/scripts/sidebar-resizer";
        initSidebarResizer();
        document.addEventListener("astro:after-swap", initSidebarResizer);
      </script>
    )}`,
      position: "after",
    },
  ],
});
