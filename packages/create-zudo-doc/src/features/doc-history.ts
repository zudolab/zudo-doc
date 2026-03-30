import type { FeatureModule } from "../compose.js";

export const docHistoryFeature: FeatureModule = () => ({
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
});
