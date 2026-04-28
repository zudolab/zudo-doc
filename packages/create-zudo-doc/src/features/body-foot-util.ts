import type { FeatureModule } from "../compose.js";

export const bodyFootUtilFeature: FeatureModule = () => ({
  name: "bodyFootUtil",
  injections: [
    {
      file: "src/layouts/doc-layout.tsx",
      anchor: "// @slot:doc-layout:imports",
      content:
        'import BodyFootUtilArea from "@/components/body-foot-util-area";',
    },
    {
      file: "src/layouts/doc-layout.tsx",
      anchor: "{/* @slot:doc-layout:after-content */}",
      content: `            <BodyFootUtilArea
              currentSlug={currentSlug}
              lang={lang}
              contentDir={contentDir}
              entryId={entryId}
              docHistory={docHistory}
            />`,
    },
  ],
});
