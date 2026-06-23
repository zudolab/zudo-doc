// Re-export from the shared package — moved to @takazudo/zudo-doc/settings
// as part of the package-first migration (epic #2321, S4 #2327).
// The showcase's src/config/settings.ts and other consumers continue to
// import from this local path; it forwards to the canonical package location.
export type {
  TagGovernanceMode,
  TagVocabularyEntry,
  HeaderNavChildItem,
  HeaderNavItem,
  HeaderRightComponentName,
  HeaderRightTriggerName,
  HeaderRightComponentItem,
  HeaderRightTriggerItem,
  HeaderRightLinkItem,
  HeaderRightHtmlItem,
  HeaderRightItem,
  BodyFootUtilAreaConfig,
  ColorModeConfig,
  LocaleConfig,
  FooterLinkItem,
  FooterLinkColumn,
  FooterTaglistLocaleConfig,
  FooterTaglistConfig,
  FooterConfig,
  HtmlPreviewConfig,
  FrontmatterPreviewConfig,
  TagPlacement,
  VersionConfig,
  MetaTagsConfig,
  Settings,
} from "@takazudo/zudo-doc/settings";
