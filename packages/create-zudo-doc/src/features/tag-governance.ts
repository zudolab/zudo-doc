import type { FeatureModule } from "../compose.js";

/**
 * Tag governance feature.
 *
 * Ships the tag audit and suggest scripts. Settings (`tagVocabulary`,
 * `tagGovernance`) are emitted by `settings-gen.ts`; devDeps and
 * `tags:audit` / `tags:suggest` package scripts are added in
 * `scaffold.ts#generatePackageJson`.
 *
 * `src/config/tag-vocabulary.ts` and `tag-vocabulary-types.ts` stay in the
 * base template because `src/utils/tags.ts` and `settings-types.ts` import
 * from them regardless of whether governance is on.
 */
export const tagGovernanceFeature: FeatureModule = () => ({
  name: "tagGovernance",
  injections: [],
});
