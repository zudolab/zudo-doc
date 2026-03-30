import type { FeatureModule } from "../compose.js";

export const searchFeature: FeatureModule = () => ({
  name: "search",
  files: [
    "src/components/search.astro",
    "src/integrations/search-index.ts",
  ],
  injections: [
    {
      file: "src/components/header.astro",
      anchor: "// @slot:header:imports",
      content: 'import Search from "@/components/search.astro";',
    },
    {
      file: "src/components/header.astro",
      anchor: "<!-- @slot:header:actions-end -->",
      content: "    <Search />",
    },
  ],
});
