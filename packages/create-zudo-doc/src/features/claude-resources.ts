import type { FeatureModule } from "../compose.js";

export const claudeResourcesFeature: FeatureModule = () => ({
  name: "claudeResources",
  injections: [
    // Plugin entry is handled by zfb-config-gen.ts — no shared file injection needed
  ],
});
