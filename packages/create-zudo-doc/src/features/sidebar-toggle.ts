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
      content:
        'import DesktopSidebarToggle from "@/components/desktop-sidebar-toggle";',
    },
    {
      // Inline script: applies sidebar visible/hidden state from localStorage
      // before first paint. Uses dangerouslySetInnerHTML because JSX layouts
      // do not have Astro's is:inline script bundling.
      file: "src/layouts/doc-layout.astro",
      anchor: "<!-- @slot:doc-layout:head-scripts -->",
      content: `    {settings.sidebarToggle && (
      <script dangerouslySetInnerHTML={{ __html: \`(function () {
  function applySidebarState() {
    if (localStorage.getItem("zudo-doc-sidebar-visible") === "false") {
      document.documentElement.setAttribute("data-sidebar-hidden", "");
    } else {
      document.documentElement.removeAttribute("data-sidebar-hidden");
    }
  }
  applySidebarState();
})();\` }} />
    )}`,
      position: "after",
    },
    {
      // Island when="load" replaces the Astro client:load directive.
      // transition:persist is dropped — the zfb layout manages persistence
      // through the framework's view-transition primitives instead.
      file: "src/layouts/doc-layout.astro",
      anchor: "<!-- @slot:doc-layout:after-sidebar -->",
      content: `    {!hideSidebar && settings.sidebarToggle && (
      <Island when="load">
        <DesktopSidebarToggle />
      </Island>
    )}`,
      position: "after",
    },
    {
      // Replace the simple content-wrapper div with the toggle-aware version.
      // class:list (Astro directive) becomes a filter+join expression (JSX).
      file: "src/layouts/doc-layout.astro",
      anchor: "<!-- @slot:doc-layout:content-wrapper:start -->",
      content: `    <div class={[!hideSidebar && "lg:ml-[var(--zd-sidebar-w)]", !hideSidebar && settings.sidebarToggle && "zd-sidebar-content-wrapper"].filter(Boolean).join(" ")}>`,
      position: "replace",
    },
  ],
});
