import type { FeatureModule } from "../compose.js";

export const sidebarToggleFeature: FeatureModule = () => ({
  name: "sidebarToggle",
  injections: [
    {
      file: "src/styles/global.css",
      anchor: "/* @slot:global-css:feature-styles */",
      content: `/* Sidebar toggle button — left position uses CSS variable */
@media (min-width: 1024px) {
  .zd-desktop-sidebar-toggle {
    left: var(--zd-sidebar-w);
  }

  html[data-sidebar-hidden] .zd-desktop-sidebar-toggle {
    left: 0;
  }
}`,
      position: "after",
    },
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "// @slot:doc-layout:imports",
      content: 'import DesktopSidebarToggle from "@/components/desktop-sidebar-toggle";',
    },
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "<!-- @slot:doc-layout:head-scripts -->",
      content: `    {settings.sidebarToggle && (
      <script is:inline>
        (function () {
          function applySidebarState() {
            if (localStorage.getItem("zudo-doc-sidebar-visible") === "false") {
              document.documentElement.setAttribute("data-sidebar-hidden", "");
            } else {
              document.documentElement.removeAttribute("data-sidebar-hidden");
            }
          }
          applySidebarState();
          if (!window.__zdSidebarApplied) {
            document.addEventListener("astro:after-swap", applySidebarState);
            window.__zdSidebarApplied = true;
          }
        })();
      </script>
    )}`,
      position: "after",
    },
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "<!-- @slot:doc-layout:after-sidebar -->",
      content: `    {!hideSidebar && settings.sidebarToggle && (
      <DesktopSidebarToggle
        client:load
        transition:persist="desktop-sidebar-toggle"
      />
    )}`,
      position: "after",
    },
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "<!-- @slot:doc-layout:content-wrapper:start -->",
      content: `    <div class:list={[!hideSidebar && "lg:ml-[var(--zd-sidebar-w)]", !hideSidebar && settings.sidebarToggle && "zd-sidebar-content-wrapper"]}>`,
      position: "replace",
    },
  ],
});
