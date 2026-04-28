import type { FeatureModule } from "../compose.js";

export const searchFeature: FeatureModule = () => ({
  name: "search",
  injections: [
    {
      file: "src/components/header.tsx",
      anchor: "// @slot:header:imports",
      content: 'import Search from "@/components/search";',
    },
    {
      file: "src/components/header.tsx",
      anchor: "{/* @slot:header:actions-end */}",
      content: "    <Search />",
    },
  ],
});
