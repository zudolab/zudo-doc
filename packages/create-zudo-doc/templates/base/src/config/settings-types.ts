// Re-export most types from the shared package — moved to @takazudo/zudo-doc/settings
// as part of the package-first migration (epic #2321, S4 #2327).
// HeaderRightTriggerName and HeaderRightTriggerItem are defined locally rather than
// re-exported from the package because the designTokenPanel feature injects
// "design-token-panel" | into HeaderRightTriggerName via the @slot anchor; the
// package unconditionally includes both trigger names but the base template
// ships only "ai-chat", and the feature overlay adds the design-token-panel
// variant via the compose engine.  HeaderRightTriggerItem references the local
// HeaderRightTriggerName, so it stays local too.
export type {
  TagGovernanceMode,
  TagVocabularyEntry,
  HeaderNavChildItem,
  HeaderNavItem,
  HeaderRightComponentName,
  HeaderRightComponentItem,
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

// @slot:settings-types:trigger-names:start
export type HeaderRightTriggerName = "ai-chat";
// @slot:settings-types:trigger-names:end

export interface HeaderRightTriggerItem {
  type: "trigger";
  trigger: HeaderRightTriggerName;
}
