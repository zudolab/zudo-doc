import type { FeatureModule } from "../compose.js";

export const claudeResourcesFeature: FeatureModule = () => ({
  name: "claudeResources",
  injections: [
    // No shared file injection needed — this feature's touch points are:
    //   - plugin entry: zfb-config-gen.ts (claudeResources conditional import/plugin)
    //   - settings: settings-gen.ts (claudeResources object + defaultLocaleOnlyPrefixes array)
    //   - devDep: scaffold.ts (tsx devDep — same subprocess runner as docHistory)
  ],
});
