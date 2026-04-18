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
  margin-inline: 0;
  margin-block-end: 0;
}

.zd-enlargeable img {
  display: block;
  max-width: 100%;
  height: auto;
}

.zd-enlarge-btn {
  position: absolute;
  top: var(--spacing-image-overlay-inset);
  right: var(--spacing-image-overlay-inset);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-image-overlay-inset);
  border: none;
  background: transparent;
  cursor: pointer;
  z-index: 1;
  transition: opacity var(--default-transition-duration);
}

.zd-enlarge-btn::before {
  content: "";
  position: absolute;
  inset: 0;
  background: color-mix(in oklch, var(--color-image-overlay-bg) 80%, transparent);
  z-index: 0;
}

.zd-enlarge-btn > svg {
  position: relative;
  z-index: 1;
  width: var(--spacing-icon-sm);
  height: var(--spacing-icon-sm);
  color: var(--color-image-overlay-fg);
  fill: currentColor;
}

.zd-enlarge-btn:hover {
  opacity: 0.8;
}

.zd-enlarge-btn[hidden] {
  display: none !important;
}

dialog.zd-enlarge-dialog::backdrop {
  background: color-mix(in oklch, var(--color-overlay) 80%, transparent);
}

.zd-enlarge-dialog-close {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-image-overlay-inset);
  border: none;
  background: transparent;
  cursor: pointer;
  z-index: 1;
  transition: opacity var(--default-transition-duration);
}

.zd-enlarge-dialog-close:hover {
  opacity: 0.8;
}

.zd-enlarge-dialog-close::before {
  content: "";
  position: absolute;
  inset: 0;
  background: color-mix(in oklch, var(--color-image-overlay-bg) 80%, transparent);
  z-index: 0;
}

.zd-enlarge-dialog-close > svg {
  position: relative;
  z-index: 1;
  width: var(--spacing-icon-md);
  height: var(--spacing-icon-md);
  color: var(--color-image-overlay-fg);
  fill: currentColor;
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
