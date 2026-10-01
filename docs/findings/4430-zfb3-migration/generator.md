# Update create-zudo-doc: v3 templates, dependencies, generated text and generator tests

Owner: [#4463](https://github.com/zudolab/zudo-doc/issues/4463). Status: **generator port complete; packed consumer and browser proof deferred**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Pure CLI/config modules are explicitly audited as generator logic; actual JSX/CSS output sites are recorded separately.

## Round-2 locked spec (3.1.0)

Decision [#4480](https://github.com/zudolab/zudo-doc/issues/4480), based on [#4479 packed evidence](../../../_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md). Generator implementation and focused source-mode evidence are complete; packed consumer and browser evidence remain with #4475. This overrides the named round-1 deviations.

Void temporary physical package/zdtp CSS imports, #3364 comments and the claim that public imports await a future fix. Generated global.css uses public `@takazudo/zudo-doc/<name>.css` exports; the DesignTokenPanel feature emits `@takazudo/zdtp/styles.css`. #4479 Z06/D01 proves packed-consumer resolution on 3.1.0. Generated zfb family pins follow #4436's exact 3.1.0 lock and peer compatibility floor; keep zdtp's Preact peer because its packaging is still partial. Preserve owned JSX, manifest and removed safelist/theme-no-reset changes. Test template/emitter strings and request the packed generated-consumer build with relative CSS assets plus hydration/interaction from #4475.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/create-zudo-doc/src/api.ts` | `CreateOptions` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/api.ts` | `createZudoDoc` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/claude-md-gen.ts` | `generateCLAUDEFile` | Generated CLAUDE.md technology and CSS guidance. | Updated for zudo-react, zudo-wind, public CSS exports, owned-v1 reset, and top-level wind override; scaffold test passes. |
| `packages/create-zudo-doc/src/cli.ts` | `CliArgs` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/cli.ts` | `layerAdditionalLangs` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/cli.ts` | `parseArgs` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/cli.ts` | `printHelp` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/cli.ts` | `validateArgs` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/compose.ts` | `Injection` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/compose.ts` | `FeatureDefinition` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/compose.ts` | `FeatureModule` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/compose.ts` | `applyInjections` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/compose.ts` | `cleanAnchors` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/compose.ts` | `copyFeatureFiles` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/compose.ts` | `resolveSelectedFeatures` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/compose.ts` | `validateDependencies` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/compose.ts` | `ANCHOR_FILES` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/compose.ts` | `composeFeatures` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/constants.ts` | `LightDarkPairing` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/constants.ts` | `LIGHT_DARK_PAIRINGS` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/constants.ts` | `SINGLE_SCHEMES` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/constants.ts` | `LIGHT_SCHEMES` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/constants.ts` | `SupportedLang` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/constants.ts` | `SUPPORTED_LANGS` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/constants.ts` | `ThemePackOption` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/constants.ts` | `THEME_PACKS` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/constants.ts` | `Feature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/constants.ts` | `FEATURES` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/constants.ts` | `HEADER_RIGHT_LABELS` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/asset-viewer.ts` | `assetViewerFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/body-foot-util.ts` | `bodyFootUtilFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/claude-resources.ts` | `claudeResourcesFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/codex-resources.ts` | `codexResourcesFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/design-token-panel.ts` | `designTokenPanelFeature` | Conditional zdtp stylesheet import. | Uses public @takazudo/zdtp/styles.css after public theme.css; scaffold CSS/dependency tests pass. |
| `packages/create-zudo-doc/src/features/doc-history.ts` | `docHistoryFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/doc-tags.ts` | `docTagsFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/dynamic-page-transition.ts` | `dynamicPageTransitionFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/footer-taglist.ts` | `footerTaglistFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/footer.ts` | `footerFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/i18n.ts` | `i18nFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/image-enlarge.ts` | `imageEnlargeFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/index.ts` | `featureModules` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/llms-txt.ts` | `llmsTxtFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/search.ts` | `searchFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/sidebar-resizer.ts` | `sidebarResizerFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/sidebar-toggle.ts` | `sidebarToggleFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/tag-governance.ts` | `tagGovernanceFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/tag-governance.ts` | `tagVocabulary` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/tauri-dev.ts` | `tauriDevFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/tauri.ts` | `tauriFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/theme-pack-switcher.ts` | `themePackSwitcherFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/toc-toggle.ts` | `tocToggleFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/features/versioning.ts` | `versioningFeature` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/index.ts` | `main` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/locale-plan.ts` | `LocalePlanInput` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/locale-plan.ts` | `LocalePlan` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/locale-plan.ts` | `normalizeLocale` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/locale-plan.ts` | `resolveLocalePlan` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/preset.ts` | `PresetHeaderRightComponentName` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/preset.ts` | `PresetHeaderRightTriggerName` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/preset.ts` | `PresetHeaderRightComponentItem` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/preset.ts` | `PresetHeaderRightTriggerItem` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/preset.ts` | `PresetHeaderRightItem` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/preset.ts` | `PresetMetaTagsConfig` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/preset.ts` | `parseChangelogPackages` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/preset.ts` | `validateChangelogPackages` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/preset.ts` | `validateHeaderRightItems` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/preset.ts` | `validateMetaTags` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/preset.ts` | `PresetJson` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/preset.ts` | `loadPreset` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/preset.ts` | `validatePreset` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/preset.ts` | `presetToChoices` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/prompts.ts` | `UserChoices` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/prompts.ts` | `PartialChoices` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/prompts.ts` | `runPrompts` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/scaffold.ts` | `deriveDocSkillName` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/scaffold.ts` | `ZUDO_DOC_PIN` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/scaffold.ts` | `shouldCopyBaseFile` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/scaffold.ts` | `scaffold` | Generated starter README content. | EN/JA introductions now name zudo-react and zudo-wind and describe the wind preset override; scaffold test passes. |
| `packages/create-zudo-doc/src/scaffold.ts` | `generatePackageJson` | Generated dependency manifest. | Removed preact-render-to-string; Preact is conditional on DesignTokenPanel as zdtp peer; scaffold tests pass. |
| `packages/create-zudo-doc/src/utils.ts` | `validateProjectName` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/utils.ts` | `DestinationPath` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/utils.ts` | `DestinationSplit` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/utils.ts` | `normalizeDestination` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/utils.ts` | `splitDestination` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/utils.ts` | `DestinationChoices` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/utils.ts` | `destinationLabel` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/utils.ts` | `resolveTargetDir` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/utils.ts` | `installDependencies` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/utils.ts` | `GitInitResult` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/utils.ts` | `initGitRepo` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/utils.ts` | `hasAncestorPnpmWorkspace` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/utils.ts` | `capitalize` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/utils.ts` | `getLangLabel` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/utils.ts` | `pmRunCommand` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/utils.ts` | `getSecondaryLang` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/utils.ts` | `patchFile` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/zfb-config-gen.ts` | `DEFAULT_MIRROR` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/zfb-config-gen.ts` | `raw` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/zfb-config-gen.ts` | `isRawCode` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/zfb-config-gen.ts` | `deepEqual` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/zfb-config-gen.ts` | `serializeValue` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/zfb-config-gen.ts` | `buildDesiredConfig` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/zfb-config-gen.ts` | `orderDesiredKeys` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/src/zfb-config-gen.ts` | `generateZfbConfig` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/pages/docs/[[...slug]].tsx` | `frontmatter` | Generated doc route JSX source. | Removed JSX runtime pragma and retained the public zfb zudo-react JSX type import; scaffold assertion passes. |
| `packages/create-zudo-doc/templates/base/pages/docs/[[...slug]].tsx` | `paths` | Generated doc route JSX source. | Removed JSX runtime pragma and retained the public zfb zudo-react JSX type import; scaffold assertion passes. |
| `packages/create-zudo-doc/templates/base/pages/docs/[[...slug]].tsx` | `DocsPage` | Generated doc route JSX source. | Removed JSX runtime pragma and retained the public zfb zudo-react JSX type import; scaffold assertion passes. |
| `packages/create-zudo-doc/templates/base/pages/index.tsx` | `module / template` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `parseCliArgs` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `fileExists` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `isDirectory` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `collectFiles` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `skipTrivia` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `readStringEnd` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `readStringValue` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `matchingDelimiter` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `valueEndAtComma` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `parseObjectEntries` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `readLiteralBoolean` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `readObjectValue` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `findZudoDocCall` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `parseZfbConfig` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `parseBasePath` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `parseTrailingSlash` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `parseContentDirs` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `decodeHtmlAttributeValue` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `classifyHtmlAnchorHrefs` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `extractHtmlLinks` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `extractProtocolRelativeHtmlLinks` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `extractHtmlIds` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `safeDecodePath` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `parseHref` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `stripInlineCode` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `assertLocaleList` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `extractMdxAbsoluteLinks` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `extractMdxFragmentLinks` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `allHierarchicalHeadingIds` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `extractStaticMdxIds` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `resolveMdxTarget` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `checkMdxAnchors` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `resolveBuiltPath` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `resolveDistTarget` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `resolveLinkDetail` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `resolveLink` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `checkHtmlLinksAndTrailing` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `checkMdxLinks` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `protocolRelativeAuthority` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `isLikelyInternalPathTypo` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `formatReport` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `readAllowlist` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `entryKey` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/scripts/check-links.js` | `main` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/base/src/styles/global.css` | `module / template` | Generated base CSS imports, reset-layer order, and token override slot. | Uses public package CSS imports, @layer zw-reset/zd-flow, and :root; scaffold CSS tests pass; computed styles deferred to #4475. |
| `packages/create-zudo-doc/templates/base/tsconfig.json` | `module / template` | Project JSX source and path aliases. | React/Preact aliases removed; package base supplies zfb zudo-react JSX; scaffold assertion passes. |
| `packages/create-zudo-doc/templates/features/claudeSkills/files/.claude/skills/zudo-doc-design-system/SKILL.md` | `module / template` | Generated design-system skill guidance. | Updated for zudo-wind, :root custom properties, public CSS, and zfb.config.ts wind overrides; skill test passes. |
| `packages/create-zudo-doc/templates/features/claudeSkills/files/.claude/skills/zudo-doc-translate/SKILL.md` | `module / template` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/features/claudeSkills/files/.claude/skills/zudo-doc-version-bump/SKILL.md` | `module / template` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/features/claudeSkillsWriting/files/.claude/skills/zudo-doc-writing/SKILL.md` | `module / template` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/features/i18n/files/pages/[locale]/docs/[[...slug]].tsx` | `frontmatter` | Generated doc route JSX source. | Removed JSX runtime pragma and retained the public zfb zudo-react JSX type import; scaffold assertion passes. |
| `packages/create-zudo-doc/templates/features/i18n/files/pages/[locale]/docs/[[...slug]].tsx` | `paths` | Generated doc route JSX source. | Removed JSX runtime pragma and retained the public zfb zudo-react JSX type import; scaffold assertion passes. |
| `packages/create-zudo-doc/templates/features/i18n/files/pages/[locale]/docs/[[...slug]].tsx` | `LocaleDocsPage` | Generated doc route JSX source. | Removed JSX runtime pragma and retained the public zfb zudo-react JSX type import; scaffold assertion passes. |
| `packages/create-zudo-doc/templates/features/tauri/files/src-tauri/capabilities/default.json` | `module / template` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/features/tauri/files/src-tauri/tauri.conf.json` | `module / template` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/features/tauriDev/files/src-tauri-dev/capabilities/default.json` | `module / template` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |
| `packages/create-zudo-doc/templates/features/tauriDev/files/src-tauri-dev/tauri.conf.json` | `module / template` | Generator logic or static data; no JSX runtime or authored CSS site. | Reviewed; no v2 runtime/style surface to port. |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| No direct site in generator source or templates | `rawHtml` / `dangerouslySetInnerHTML` scan of production generator paths | Verified none; no HTML payload is introduced by this topic. The package-owned head script remains outside generator ownership. |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| `packages/create-zudo-doc/templates/base/src/styles/global.css` | Package CSS import order, zudo-wind reset layers, and :root overrides | Generated base CSS imports, reset-layer order, and token override slot. | Uses public package CSS imports, @layer zw-reset/zd-flow, and :root; scaffold CSS tests pass; computed styles deferred to #4475. |

## Tests and completion evidence

Existing candidate test files (ownership exceptions in the issue still apply):

- `packages/create-zudo-doc/src/__tests__/barebone-build.slow.test.ts` — Not run in this leaf topic: generated-project install/build coverage is deferred to the migration integration lane; packed scaffold proof belongs to #4475.
- `packages/create-zudo-doc/src/__tests__/bugfix-1793-sidebar-restore.test.ts` — Passed in the final `pnpm --filter create-zudo-doc test` run (16 files, 772 tests).
- `packages/create-zudo-doc/src/__tests__/bugfix-1795-doc-history-warn.test.ts` — Passed in the final `pnpm --filter create-zudo-doc test` run (16 files, 772 tests).
- `packages/create-zudo-doc/src/__tests__/bugfix-3104-admonition-title-syntax.test.ts` — Passed in the final `pnpm --filter create-zudo-doc test` run (16 files, 772 tests).
- `packages/create-zudo-doc/src/__tests__/chrome-bindings-build.slow.test.ts` — Not run in this leaf topic: generated-project install/build coverage is deferred to the migration integration lane; packed scaffold proof belongs to #4475.
- `packages/create-zudo-doc/src/__tests__/claude-skills-drift.test.ts` — Passed in the final `pnpm --filter create-zudo-doc test` run (16 files, 772 tests).
- `packages/create-zudo-doc/src/__tests__/claude-skills-scaffold-refs.test.ts` — Passed in the final `pnpm --filter create-zudo-doc test` run (16 files, 772 tests).
- `packages/create-zudo-doc/src/__tests__/claude-skills-tarball.test.ts` — Passed in the final `pnpm --filter create-zudo-doc test` run (16 files, 772 tests).
- `packages/create-zudo-doc/src/__tests__/cli.test.ts` — Passed in the final `pnpm --filter create-zudo-doc test` run (16 files, 772 tests).
- `packages/create-zudo-doc/src/__tests__/compose.test.ts` — Passed in the final `pnpm --filter create-zudo-doc test` run (16 files, 772 tests).
- `packages/create-zudo-doc/src/__tests__/default-mirror-parity.test.ts` — Passed in the final `pnpm --filter create-zudo-doc test` run (16 files, 772 tests).
- `packages/create-zudo-doc/src/__tests__/favicon-tarball.test.ts` — Passed in the final `pnpm --filter create-zudo-doc test` run (16 files, 772 tests).
- `packages/create-zudo-doc/src/__tests__/init-git-repo.slow.test.ts` — Not run in this leaf topic: generated-project install/build coverage is deferred to the migration integration lane; packed scaffold proof belongs to #4475.
- `packages/create-zudo-doc/src/__tests__/locale-plan.test.ts` — Passed in the final `pnpm --filter create-zudo-doc test` run (16 files, 772 tests).
- `packages/create-zudo-doc/src/__tests__/preset-swap.slow.test.ts` — Not run in this leaf topic: generated-project install/build coverage is deferred to the migration integration lane; packed scaffold proof belongs to #4475.
- `packages/create-zudo-doc/src/__tests__/preset.test.ts` — Passed in the final `pnpm --filter create-zudo-doc test` run (16 files, 772 tests).
- `packages/create-zudo-doc/src/__tests__/scaffold.test.ts` — Passed in the final `pnpm --filter create-zudo-doc test` run (16 files, 772 tests).
- `packages/create-zudo-doc/src/__tests__/skill-name-parity.slow.test.ts` — Not run in this leaf topic: generated-project install/build coverage is deferred to the migration integration lane; packed scaffold proof belongs to #4475.
- `packages/create-zudo-doc/src/__tests__/slow-build-helpers.ts` — Helper reviewed; no runtime change beyond wording. Slow generated-project build tests were not run in this leaf topic.
- `packages/create-zudo-doc/src/__tests__/template-check-links.test.ts` — Passed in the final `pnpm --filter create-zudo-doc test` run (16 files, 772 tests) after the guarded package artifact build supplied the required `dist/extract-headings/index.js`.
- `packages/create-zudo-doc/src/__tests__/three-locale-integration.slow.test.ts` — Not run in this leaf topic: generated-project install/build coverage is deferred to the migration integration lane; packed scaffold proof belongs to #4475.
- `packages/create-zudo-doc/src/__tests__/utils.test.ts` — Passed in the final `pnpm --filter create-zudo-doc test` run (16 files, 772 tests).
- `packages/create-zudo-doc/src/__tests__/zfb-config-gen.test.ts` — Passed in the final `pnpm --filter create-zudo-doc test` run (16 files, 772 tests).

The source-resolution, port-check, focused test, drift-check, and remaining-diagnostic results are recorded below. Runtime SSR/hydration, navigation, and parser/prop behavior are owned by the package topics; generated CSS computed-style evidence remains with #4475.

| Completion field | Owner must fill |
| --- | --- |
| Port-check / unit evidence | `node scripts/zfb3-port-check.mjs packages/create-zudo-doc/src/scaffold.ts packages/create-zudo-doc/src/claude-md-gen.ts packages/create-zudo-doc/src/features/design-token-panel.ts 'packages/create-zudo-doc/templates/base/pages/docs/[[...slug]].tsx' 'packages/create-zudo-doc/templates/features/i18n/files/pages/[locale]/docs/[[...slug]].tsx'` → 0 owned diagnostics, 304 unrelated migration-window diagnostics. Focused source-mode tests → 3 files / 376 passed. `timeout 1800 bash "$HOME/.codex/scripts/heavy-guard.sh" -- pnpm --filter @takazudo/zudo-doc exec tsup --silent` → `verdict=PASS`, 2s, min_mem_mb=6446. `pnpm --filter create-zudo-doc test` → 16 files / 772 tests passed. `pnpm check:template-drift` and `git diff --check` pass. |
| RawHtml review verdict per site | Verified none: no `rawHtml`, `dangerouslySetInnerHTML`, or `innerHTML` implementation in generator production source/templates. |
| Deliberate DOM/class/behavior differences and cause | Generated CSS now declares zudo-wind layers and imports package-owned reset/utilities through zfb plus public zudo-doc CSS exports. Token overrides use `:root`; the DesignTokenPanel stylesheet is an optional import after theme.css. No generator-authored utility selectors or route DOM changes. |
| Upstream issue/shim and removal version | #3364 uses the native public CSS export path on packed zfb 3.1.0 (#4479 Z06/D01); no physical `dist/*.css` workaround remains. #3368 standalone CSS authoring is unused because the package preset consumes its public `wind.json` manifest. No source shim. |
| Browser/visual cases handed to #4468/#4475 | #4475: packed barebone and all-features generated consumer build, relative CSS asset resolution, and zudo-react hydration/interaction. #4468/#4475: computed style, reset controls, light/dark, and DesignTokenPanel variable behavior. |
| Final commit / reviewer / date | Commit SHA is reported in the topic handoff; parent review pending; 2026-10-02. |
