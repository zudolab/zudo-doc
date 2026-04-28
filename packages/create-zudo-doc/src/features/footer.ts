import type { FeatureModule } from "../compose.js";

export const footerFeature: FeatureModule = () => ({
  name: "footer",
  injections: [
    {
      file: "src/layouts/doc-layout.tsx",
      anchor: "// @slot:doc-layout:imports",
      content: 'import Footer from "@/components/footer";',
    },
    {
      file: "src/layouts/doc-layout.tsx",
      anchor: "{/* @slot:doc-layout:footer */}",
      content: "      <Footer lang={lang} />",
      position: "after",
    },
  ],
});
