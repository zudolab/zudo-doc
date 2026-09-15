/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";
import { assertChromeContext } from "../chrome/assert-chrome-context.js";
import { deriveBodyEndIslands, deriveComposeMetaTitle } from "../chrome/derive.js";
import { derivePrimaryChromeSlots } from "../chrome/primary-slots.js";
import { DocLayoutWithDefaults } from "../doclayout/index.js";
import type { ChromeContext } from "../factory-context/index.js";
import { createHeadWithDefaults } from "../head-with-defaults/index.js";
import type { AssetIndexEntry } from "../route-context-payload/types.js";
import type { Settings } from "../settings.js";
import { resolveThemePackSsrSlug } from "../theme/theme-pack-provider.js";
import { AssetIndexPageBody, resolveAssetIndexPageLabels } from "./body.js";

export { ASSET_INDEX_PAGE_SCRIPT } from "./script.js";
export { buildAssetTree } from "./tree.js";
export type { AssetTreeNode } from "./tree.js";
export {
  AssetIndexPageBody,
  AssetTree,
  iconFor,
  resolveAssetIndexPageLabels,
  type AssetIndexPageBodyProps,
  type AssetIndexPageLabels,
} from "./body.js";

export interface AssetIndexPageViewProps {
  entries: AssetIndexEntry[];
  locale?: string;
}

/** Build the package-owned wide asset index from a chrome context. */
export function createAssetIndexPageView<S extends Settings = Settings>(ctx: ChromeContext<S>): (props: AssetIndexPageViewProps) => JSX.Element {
  assertChromeContext(ctx, "createAssetIndexPageView");
  const settings = ctx.settings;
  const t = ctx.t;
  const composeMetaTitle = deriveComposeMetaTitle(ctx);
  const HeadWithDefaults = createHeadWithDefaults(ctx);
  const { Header: HeaderWithDefaults, Footer: FooterWithDefaults, Breadcrumb: BreadcrumbWithDefaults } = derivePrimaryChromeSlots(ctx);
  const BodyEndIslands = deriveBodyEndIslands(ctx);
  const dataThemePack = resolveThemePackSsrSlug(ctx.themePackRegistry, settings);

  return function AssetIndexPageView({ entries, locale = ctx.defaultLocale }: AssetIndexPageViewProps): JSX.Element {
    const localeSegment = locale === ctx.defaultLocale ? undefined : locale;
    const routePrefix = ctx.assetManifest?.routePrefix ?? settings.assetViewerRoutePrefix;
    const dir = ctx.assetManifest?.dir ?? settings.assetViewerDir;
    const indexUrl = ctx.withBase(`/${localeSegment ? `${localeSegment}/` : ""}${routePrefix}/`);
    const homeUrl = ctx.withBase(`/${localeSegment ? `${localeSegment}/` : ""}`);
    const labels = resolveAssetIndexPageLabels(t, locale);
    const title = labels.crumb;
    return (
      <DocLayoutWithDefaults title={composeMetaTitle(title)} head={<HeadWithDefaults title={title} description={labels.indexDescription} canonical={ctx.absoluteUrl(indexUrl)} />} lang={locale} dataThemePack={dataThemePack} noindex={settings.noindex} hideSidebar hideToc sidebarOverride={false} contentWide breadcrumbOverride={<BreadcrumbWithDefaults items={[{ label: "", href: homeUrl }, { label: title }]} />} headerOverride={<HeaderWithDefaults lang={locale} currentPath={indexUrl} hideSidebarToggle />} footerOverride={<FooterWithDefaults lang={locale} />} bodyEndComponents={<BodyEndIslands basePath={settings.base ?? "/"} />} enableClientRouter={settings.dynamicPageTransition}>
        <AssetIndexPageBody entries={entries} labels={labels} base={settings.base} routePrefix={routePrefix} dir={dir} locale={localeSegment} />
      </DocLayoutWithDefaults>
    );
  };
}
