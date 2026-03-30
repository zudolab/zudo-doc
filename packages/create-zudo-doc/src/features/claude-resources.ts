import type { FeatureModule } from "../compose.js";

export const claudeResourcesFeature: FeatureModule = () => ({
  name: "claudeResources",
  injections: [
    // Integration is handled by astro-config-gen.ts — no shared file injection needed
  ],
});
