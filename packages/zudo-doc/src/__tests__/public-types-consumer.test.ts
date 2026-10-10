import { expectTypeOf, it } from "vitest";
import type { Child, Component, Description, ReadonlySignal } from "@takazudo/zfb/zudo-react";
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { jsx } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { defineChromeBindings } from "@takazudo/zudo-doc/chrome-bindings";
import { modalDialog } from "@takazudo/zudo-doc/use-modal-dialog";
import type {
  BodyEndIslandsSlotProps,
  BreadcrumbSlotProps,
  ChatMessage,
  ChromeBindingsInput,
  ChromeContext,
  ChromeHostBindings,
  DesignTokenPanelBootstrapSlotProps,
  DocHistoryData,
  DocHistoryEntry,
  DocHistorySlotProps,
  DocPagerSlotProps,
  EnlargeDialogProps,
  FactoryComponent,
  FactoryComponents,
  FactoryContext,
  FactoryI18n,
  FooterSlotProps,
  FooterTagEntry,
  FrontmatterCellRenderer,
  FrontmatterCellRendererProps,
  FrontmatterRendererSlotProps,
  HeaderNavChildItem,
  HeaderNavItem,
  HeaderRightBuiltinComponentName,
  HeaderRightComponentItem,
  HeaderRightComponentName,
  HeaderRightComponentProps,
  HeaderRightComponentRegistry,
  HeaderRightHtmlItem,
  HeaderRightItem,
  HeaderRightItemFlags,
  HeaderRightLinkItem,
  HeaderRightTriggerItem,
  HeaderRightTriggerName,
  HeaderSlotProps,
  Locale,
  ModalDialogOptions,
  ModalDialogResult,
  NavSource,
  RouteContext,
  RouteContextPayload,
  RouteHrefBuilder,
  SearchWidgetSlotProps,
  SidebarSlotProps,
  TagInfo,
  ThemePackDialogComponent,
  ThemePackDialogProps,
  TocSlotProps,
} from "@takazudo/zudo-doc";
import type { FrontmatterCellRenderer as SubpathFrontmatterCellRenderer } from "@takazudo/zudo-doc/metainfo";
import type {
  HeaderRightComponentRegistry as SubpathHeaderRightComponentRegistry,
} from "@takazudo/zudo-doc/header";
import type {
  ModalDialogOptions as SubpathModalDialogOptions,
  ModalDialogResult as SubpathModalDialogResult,
} from "@takazudo/zudo-doc/use-modal-dialog";

type Assert<T extends true> = T;
type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2
    ? true
    : false;

// Name every root-barrel export in one consumer type so additions, missing
// re-exports, and declaration drift are caught by the source-resolution lane.
type RootTypeSurface = [
  BodyEndIslandsSlotProps,
  BreadcrumbSlotProps,
  ChatMessage,
  ChromeBindingsInput,
  ChromeContext,
  ChromeHostBindings,
  DesignTokenPanelBootstrapSlotProps,
  DocHistoryData,
  DocHistoryEntry,
  DocHistorySlotProps,
  DocPagerSlotProps,
  EnlargeDialogProps,
  FactoryComponent,
  FactoryComponents,
  FactoryContext,
  FactoryI18n,
  FooterSlotProps,
  FooterTagEntry,
  FrontmatterCellRenderer,
  FrontmatterCellRendererProps,
  FrontmatterRendererSlotProps,
  HeaderNavChildItem,
  HeaderNavItem,
  HeaderRightBuiltinComponentName,
  HeaderRightComponentItem,
  HeaderRightComponentName,
  HeaderRightComponentProps,
  HeaderRightComponentRegistry,
  HeaderRightHtmlItem,
  HeaderRightItem,
  HeaderRightItemFlags,
  HeaderRightLinkItem,
  HeaderRightTriggerItem,
  HeaderRightTriggerName,
  HeaderSlotProps,
  Locale,
  ModalDialogOptions,
  ModalDialogResult,
  NavSource,
  RouteContext,
  RouteContextPayload,
  RouteHrefBuilder,
  SearchWidgetSlotProps,
  SidebarSlotProps,
  TagInfo,
  ThemePackDialogComponent,
  ThemePackDialogProps,
  TocSlotProps,
];

type _ThemePackOpenIsSignal = Assert<
  Equal<ThemePackDialogProps["open"], ReadonlySignal<boolean>>
>;
type _ThemePackComponentUsesOwnedComponent = Assert<
  Equal<ThemePackDialogComponent, Component<ThemePackDialogProps>>
>;
type _FrontmatterComponentUsesOwnedComponent = Assert<
  Equal<FrontmatterCellRenderer, Component<FrontmatterCellRendererProps>>
>;
type _FrontmatterSubpathPreservesDomainType = Assert<
  Equal<SubpathFrontmatterCellRenderer, FrontmatterCellRenderer>
>;
type _HeaderSubpathPreservesRegistry = Assert<
  Equal<SubpathHeaderRightComponentRegistry, HeaderRightComponentRegistry>
>;
type _ModalSubpathPreservesTypes = Assert<
  Equal<SubpathModalDialogOptions, ModalDialogOptions> &
    Equal<SubpathModalDialogResult, ModalDialogResult>
>;
type _BreadcrumbSlotUsesChild = Assert<
  Equal<BreadcrumbSlotProps["rightSlot"], Child | undefined>
>;
type _EnlargeClassUsesClass = Assert<Equal<EnlargeDialogProps["class"], string>>;
type _EnlargeStyleIsNativeObject = Assert<EnlargeDialogProps["style"] extends object ? true : false>;

const intrinsicButtonProps: JSX.IntrinsicElements["button"] = {
  class: "rounded",
  type: "button",
};
const description: Description = jsx("button", { class: "rounded", type: "button" });
const publicBindings = defineChromeBindings({
  Breadcrumb: ({ items, rightSlot }) => [items[0]?.label, rightSlot],
  headerRightComponents: {
    "consumer-badge": ({ themeToggle }) => themeToggle,
  },
  frontmatterRenderers: {
    status: ({ value }) => String(value),
  },
  mdxExtras: {
    Badge: (_props: Record<string, unknown>) => "badge",
  },
});

it("exposes the zfb 3 public types through a tiny consumer surface", () => {
  expectTypeOf(publicBindings).toMatchTypeOf<ChromeHostBindings>();
  expectTypeOf<RootTypeSurface>().toBeArray();
  expectTypeOf(intrinsicButtonProps).toMatchTypeOf<JSX.IntrinsicElements["button"]>();
  expectTypeOf<Description>().toMatchTypeOf<Child>();
  expectTypeOf(modalDialog).toBeFunction();
  expectTypeOf(description).toMatchTypeOf<Description>();
});
