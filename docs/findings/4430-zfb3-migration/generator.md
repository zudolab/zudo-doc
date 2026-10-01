# Update create-zudo-doc: v3 templates, dependencies, generated text and generator tests

Owner: [#4463](https://github.com/zudolab/zudo-doc/issues/4463). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Round-2 locked spec (3.1.0)

Decision [#4480](https://github.com/zudolab/zudo-doc/issues/4480), based on [#4479 packed evidence](../../../_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md). Planned contract only; implementation and browser evidence remain pending. This overrides the named round-1 deviations.

Void temporary physical package/zdtp CSS imports, #3364 comments and the claim that public imports await a future fix. Generated global.css uses public `@takazudo/zudo-doc/<name>.css` exports; the DesignTokenPanel feature emits `@takazudo/zdtp/styles.css`. #4479 Z06/D01 proves packed-consumer resolution on 3.1.0. Generated zfb family pins follow #4436's exact 3.1.0 lock and peer compatibility floor; keep zdtp's Preact peer because its packaging is still partial. Preserve owned JSX, manifest and removed safelist/theme-no-reset changes. Test template/emitter strings and request the packed generated-consumer build with relative CSS assets plus hydration/interaction from #4475.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/create-zudo-doc/src/api.ts` | `CreateOptions` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/api.ts` | `createZudoDoc` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/claude-md-gen.ts` | `generateCLAUDEFile` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/cli.ts` | `CliArgs` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/cli.ts` | `layerAdditionalLangs` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/cli.ts` | `parseArgs` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/cli.ts` | `printHelp` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/cli.ts` | `validateArgs` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/compose.ts` | `Injection` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/compose.ts` | `FeatureDefinition` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/compose.ts` | `FeatureModule` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/compose.ts` | `applyInjections` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/compose.ts` | `cleanAnchors` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/compose.ts` | `copyFeatureFiles` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/compose.ts` | `resolveSelectedFeatures` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/compose.ts` | `validateDependencies` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/compose.ts` | `ANCHOR_FILES` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/compose.ts` | `composeFeatures` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/constants.ts` | `LightDarkPairing` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/constants.ts` | `LIGHT_DARK_PAIRINGS` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/constants.ts` | `SINGLE_SCHEMES` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/constants.ts` | `LIGHT_SCHEMES` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/constants.ts` | `SupportedLang` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/constants.ts` | `SUPPORTED_LANGS` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/constants.ts` | `ThemePackOption` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/constants.ts` | `THEME_PACKS` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/constants.ts` | `Feature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/constants.ts` | `FEATURES` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/constants.ts` | `HEADER_RIGHT_LABELS` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/asset-viewer.ts` | `assetViewerFeature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/body-foot-util.ts` | `bodyFootUtilFeature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/claude-resources.ts` | `claudeResourcesFeature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/codex-resources.ts` | `codexResourcesFeature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/design-token-panel.ts` | `designTokenPanelFeature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/doc-history.ts` | `docHistoryFeature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/doc-tags.ts` | `docTagsFeature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/dynamic-page-transition.ts` | `dynamicPageTransitionFeature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/footer-taglist.ts` | `footerTaglistFeature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/footer.ts` | `footerFeature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/i18n.ts` | `i18nFeature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/image-enlarge.ts` | `imageEnlargeFeature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/index.ts` | `featureModules` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/llms-txt.ts` | `llmsTxtFeature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/search.ts` | `searchFeature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/sidebar-resizer.ts` | `sidebarResizerFeature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/sidebar-toggle.ts` | `sidebarToggleFeature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/tag-governance.ts` | `tagGovernanceFeature` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/tag-governance.ts` | `tagVocabulary` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/tauri-dev.ts` | `tauriDevFeature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/tauri.ts` | `tauriFeature` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/theme-pack-switcher.ts` | `themePackSwitcherFeature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/toc-toggle.ts` | `tocToggleFeature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/features/versioning.ts` | `versioningFeature` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/index.ts` | `main` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/locale-plan.ts` | `LocalePlanInput` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/locale-plan.ts` | `LocalePlan` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/locale-plan.ts` | `normalizeLocale` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/locale-plan.ts` | `resolveLocalePlan` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/preset.ts` | `PresetHeaderRightComponentName` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/preset.ts` | `PresetHeaderRightTriggerName` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/preset.ts` | `PresetHeaderRightComponentItem` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/preset.ts` | `PresetHeaderRightTriggerItem` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/preset.ts` | `PresetHeaderRightItem` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/preset.ts` | `PresetMetaTagsConfig` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/preset.ts` | `parseChangelogPackages` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/preset.ts` | `validateChangelogPackages` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/preset.ts` | `validateHeaderRightItems` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/preset.ts` | `validateMetaTags` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/preset.ts` | `PresetJson` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/preset.ts` | `loadPreset` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/preset.ts` | `validatePreset` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/preset.ts` | `presetToChoices` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/prompts.ts` | `UserChoices` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/prompts.ts` | `PartialChoices` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/prompts.ts` | `runPrompts` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/scaffold.ts` | `deriveDocSkillName` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/scaffold.ts` | `ZUDO_DOC_PIN` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/scaffold.ts` | `shouldCopyBaseFile` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/scaffold.ts` | `scaffold` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/scaffold.ts` | `generatePackageJson` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/utils.ts` | `validateProjectName` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/utils.ts` | `DestinationPath` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/utils.ts` | `DestinationSplit` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/utils.ts` | `normalizeDestination` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/utils.ts` | `splitDestination` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/utils.ts` | `DestinationChoices` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/utils.ts` | `destinationLabel` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/utils.ts` | `resolveTargetDir` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/utils.ts` | `installDependencies` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/utils.ts` | `GitInitResult` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/utils.ts` | `initGitRepo` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/utils.ts` | `hasAncestorPnpmWorkspace` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/utils.ts` | `capitalize` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/utils.ts` | `getLangLabel` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/utils.ts` | `pmRunCommand` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/utils.ts` | `getSecondaryLang` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/utils.ts` | `patchFile` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/zfb-config-gen.ts` | `DEFAULT_MIRROR` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/zfb-config-gen.ts` | `raw` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/zfb-config-gen.ts` | `isRawCode` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/zfb-config-gen.ts` | `deepEqual` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/zfb-config-gen.ts` | `serializeValue` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/zfb-config-gen.ts` | `buildDesiredConfig` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/zfb-config-gen.ts` | `orderDesiredKeys` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/src/zfb-config-gen.ts` | `generateZfbConfig` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/pages/docs/[[...slug]].tsx` | `frontmatter` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/pages/docs/[[...slug]].tsx` | `paths` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/pages/docs/[[...slug]].tsx` | `DocsPage` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/pages/index.tsx` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `parseCliArgs` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `fileExists` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `isDirectory` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `collectFiles` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `skipTrivia` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `readStringEnd` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `readStringValue` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `matchingDelimiter` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `valueEndAtComma` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `parseObjectEntries` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `readLiteralBoolean` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `readObjectValue` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `findZudoDocCall` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `parseZfbConfig` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `parseBasePath` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `parseTrailingSlash` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `parseContentDirs` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `decodeHtmlAttributeValue` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `classifyHtmlAnchorHrefs` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `extractHtmlLinks` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `extractProtocolRelativeHtmlLinks` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `extractHtmlIds` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `safeDecodePath` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `parseHref` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `stripInlineCode` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `assertLocaleList` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `extractMdxAbsoluteLinks` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `extractMdxFragmentLinks` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `allHierarchicalHeadingIds` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `extractStaticMdxIds` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `resolveMdxTarget` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `checkMdxAnchors` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `resolveBuiltPath` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `resolveDistTarget` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `resolveLinkDetail` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `resolveLink` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `checkHtmlLinksAndTrailing` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `checkMdxLinks` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `protocolRelativeAuthority` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `isLikelyInternalPathTypo` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `formatReport` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `readAllowlist` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `entryKey` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `main` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/src/styles/global.css` | `module / template` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/base/tsconfig.json` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/features/claudeSkills/files/.claude/skills/zudo-doc-design-system/SKILL.md` | `module / template` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/features/claudeSkills/files/.claude/skills/zudo-doc-translate/SKILL.md` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/features/claudeSkills/files/.claude/skills/zudo-doc-version-bump/SKILL.md` | `module / template` | style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/features/claudeSkillsWriting/files/.claude/skills/zudo-doc-writing/SKILL.md` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/features/i18n/files/pages/[locale]/docs/[[...slug]].tsx` | `frontmatter` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/features/i18n/files/pages/[locale]/docs/[[...slug]].tsx` | `paths` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/features/i18n/files/pages/[locale]/docs/[[...slug]].tsx` | `LocaleDocsPage` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/features/tauri/files/src-tauri/capabilities/default.json` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/features/tauri/files/src-tauri/tauri.conf.json` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/features/tauriDev/files/src-tauri-dev/capabilities/default.json` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/create-zudo-doc/templates/features/tauriDev/files/src-tauri-dev/tauri.conf.json` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| No direct site in initial source scan | Check imported helpers and newly introduced rawHtml | pending confirmation; add each new site explicitly |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| `packages/create-zudo-doc/templates/base/src/styles/global.css` | Authored cascade / reset / custom properties | W-CASCADE and locked reset; every utility overlap gets winner-before/after evidence | pending computed-style proof |

## Tests and completion evidence

Existing candidate test files (ownership exceptions in the issue still apply):

- `packages/create-zudo-doc/src/__tests__/barebone-build.slow.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/bugfix-1793-sidebar-restore.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/bugfix-1795-doc-history-warn.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/bugfix-3104-admonition-title-syntax.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/chrome-bindings-build.slow.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/claude-skills-drift.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/claude-skills-scaffold-refs.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/claude-skills-tarball.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/cli.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/compose.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/default-mirror-parity.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/favicon-tarball.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/init-git-repo.slow.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/locale-plan.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/preset-swap.slow.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/preset.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/scaffold.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/skill-name-parity.slow.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/slow-build-helpers.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/template-check-links.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/three-locale-integration.slow.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/utils.test.ts` — pending port/run result.
- `packages/create-zudo-doc/src/__tests__/zfb-config-gen.test.ts` — pending port/run result.

Run the exact source-resolution and port-check commands from the conventions with this topic’s paths. Record command, result, version and remaining diagnostics. Required behavioral coverage: initial SSR, active updates, cleanup/disposal, relevant navigation and parser/prop failures. CSS changes require computed-style evidence from the verification owner; a green build is insufficient.

| Completion field | Owner must fill |
| --- | --- |
| Port-check / unit evidence | pending |
| RawHtml review verdict per site | pending (or verified none) |
| Deliberate DOM/class/behavior differences and cause | pending (or verified none) |
| Upstream issue/shim and removal version | pending (or verified none) |
| Browser/visual cases handed to #4468/#4475 | pending |
| Final commit / reviewer / date | pending |
