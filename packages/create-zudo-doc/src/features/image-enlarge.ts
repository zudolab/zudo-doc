import type { FeatureModule } from "../compose.js";

export const imageEnlargeFeature: FeatureModule = () => ({
  name: "imageEnlarge",
  injections: [
    {
      file: "src/styles/global.css",
      anchor: "/* @slot:global-css:feature-styles */",
      content: `/* ========================================
 * Image enlarge (.zd-enlargeable)
 * ======================================== */

.zd-enlargeable {
  position: relative;
  display: block;
  margin: 0;
}

.zd-enlargeable img {
  display: block;
  max-width: 100%;
  height: auto;
}

.zd-enlarge-btn {
  position: absolute;
  top: var(--spacing-vsp-xs);
  right: var(--spacing-hsp-xs);
  width: var(--spacing-icon-sm);
  height: var(--spacing-icon-sm);
  padding: 0;
  border: none;
  border-radius: var(--radius-DEFAULT);
  background: color-mix(in oklch, var(--color-overlay) 80%, transparent);
  color: var(--color-bg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  transition: opacity var(--default-transition-duration);
}

.zd-enlarge-btn[hidden] {
  display: none !important;
}

dialog.zd-enlarge-dialog::backdrop {
  background: color-mix(in oklch, var(--color-overlay) 80%, transparent);
}`,
      position: "after",
    },
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "// @slot:doc-layout:imports",
      content: 'import ImageEnlarge from "@/components/image-enlarge";',
    },
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "<!-- @slot:doc-layout:body-end-components -->",
      content: "    {settings.imageEnlarge && <ImageEnlarge client:idle />}",
      position: "after",
    },
  ],
});
