/** Scanner identity fixture for direct source-resolution composition tests. */
const runtime = globalThis as typeof globalThis & {
  __zfb?: { zudoReactBuild?: string; zudoReactIslands?: readonly string[] };
};
runtime.__zfb = {
  ...runtime.__zfb,
  zudoReactBuild: "4464-doc-composition-test",
  zudoReactIslands: [
    ...new Set([
      ...(runtime.__zfb?.zudoReactIslands ?? []),
      "AiChatModal", "ImageEnlarge", "MermaidEnlarge", "FindInPageInit",
      "DesignTokenPanelBootstrap", "ThemePackSwitcher", "SiteTreeNav",
      "SidebarTree", "SidebarToggle", "DocHistoryStub", "DocHistory",
      "MobileToc", "Toc", "HtmlPreviewWrapperInner", "DesktopTocToggle",
      "DesktopSidebarToggle", "ClientRouterBootstrap", "ThemeToggle",
      "HostOwnDesignTokenPanelBootstrap",
    ]),
  ],
};
