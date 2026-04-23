import type { FeatureModule } from "../compose.js";

export const docHistoryFeature: FeatureModule = (choices) => {
  // When bodyFootUtil is enabled, its body-foot-util-area.astro hosts the
  // DocHistory trigger directly (byte-matching the main project). So we skip
  // the doc-layout injection here to avoid rendering the trigger twice.
  if (choices.features.includes("bodyFootUtil")) {
    return { name: "docHistory", injections: [] };
  }

  return {
    name: "docHistory",
    injections: [
      {
        file: "src/layouts/doc-layout.astro",
        anchor: "// @slot:doc-layout:imports",
        content: 'import { DocHistory } from "@/components/doc-history";',
      },
      {
        file: "src/layouts/doc-layout.astro",
        anchor: "<!-- @slot:doc-layout:after-content -->",
        content: `            {settings.docHistory && currentSlug && (
              <DocHistory slug={currentSlug} locale={lang !== defaultLocale ? lang : undefined} basePath={withBase("/")} client:idle />
            )}`,
      },
    ],
  };
};
