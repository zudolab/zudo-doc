import type { FeatureModule } from "../compose.js";

/**
 * body-foot-util feature.
 *
 * Purely a `zudoDoc({ bodyFootUtilArea: {...} })` field (see
 * `zfb-config-gen.ts`) — `BodyFootUtilArea` is fully package-owned
 * (`@takazudo/zudo-doc/body-foot-util`, wired through `doc-page-shell`) and
 * runtime-gates on `settings.bodyFootUtilArea`. The old host thin-stub
 * (`src/utils/github.ts`, which depended on the now-deleted
 * `@/config/settings`) is gone too — the package component reads
 * `settings.githubUrl` from the route context directly via
 * `@takazudo/zudo-doc/github-helpers`. Nothing to inject or copy.
 */
export const bodyFootUtilFeature: FeatureModule = () => ({
  name: "bodyFootUtil",
  injections: [],
});
