/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";
import { deriveBodyEndIslands, deriveDateFormats } from "../chrome/derive.js";
import { deriveComposeMetaTitle } from "../chrome/derive.js";
import { derivePrimaryChromeSlots } from "../chrome/primary-slots.js";
import { assertChromeContext } from "../chrome/assert-chrome-context.js";
import { DocLayoutWithDefaults } from "../doclayout/index.js";
import type { ChromeContext } from "../factory-context/index.js";
import { buildGitHubSourceUrl } from "../github-helpers/index.js";
import { createHeadWithDefaults } from "../head-with-defaults/index.js";
import { assetRawHref, assetViewerHref } from "../asset-path/index.js";
import type { AssetRecord } from "../plugins/internal/asset-viewer/types.js";
import { resolveThemePackSsrSlug } from "../theme/theme-pack-provider.js";
import type { Settings } from "../settings.js";
import { AssetPageBody, renderAssetDetailsPrepaintScript, resolveAssetPageLabels } from "./body.js";

export {
  ASSET_DETAILS_HIDDEN_ATTR,
  ASSET_DETAILS_PREPAINT_SCRIPT,
  ASSET_DETAILS_STORAGE_KEY,
  ASSET_PAGE_SCRIPT,
} from "./script.js";
export type { AssetRecord } from "../plugins/internal/asset-viewer/types.js";
export {
  AssetActions,
  AssetCodeBody,
  AssetDetails,
  AssetDownloadPanel,
  AssetEyebrow,
  AssetHeader,
  AssetImageStage,
  AssetLinkedFrom,
  AssetPdfStage,
  AssetVideoStage,
  type AssetDetailsLabels,
  type AssetDetailsToggleLabels,
  type AssetImageStageLabels,
} from "./components.js";
export {
  AssetPageBody,
  resolveAssetPageLabels,
  type AssetPageBodyProps,
  type AssetPageLabels,
} from "./body.js";

export interface AssetPageViewProps {
  entry: AssetRecord;
  locale?: string;
}

/** Build the package-owned wide asset viewer page from a chrome context. */
export function createAssetPageView<S extends Settings = Settings>(ctx: ChromeContext<S>): (props: AssetPageViewProps) => JSX.Element {
  assertChromeContext(ctx, "createAssetPageView");
  const settings = ctx.settings;
  const t = ctx.t;
  const dateFormatsFor = deriveDateFormats(ctx);
  const composeMetaTitle = deriveComposeMetaTitle(ctx);
  const HeadWithDefaults = createHeadWithDefaults(ctx);
  const { Header: HeaderWithDefaults, Footer: FooterWithDefaults, Breadcrumb: BreadcrumbWithDefaults } = derivePrimaryChromeSlots(ctx);
  const BodyEndIslands = deriveBodyEndIslands(ctx);
  const dataThemePack = resolveThemePackSsrSlug(ctx.themePackRegistry, settings);

  return function AssetPageView({ entry: asset, locale = ctx.defaultLocale }: AssetPageViewProps): JSX.Element {
    const localeSegment = locale === ctx.defaultLocale ? undefined : locale;
    const routePrefix = ctx.assetManifest?.routePrefix ?? settings.assetViewerRoutePrefix;
    const dir = ctx.assetManifest?.dir ?? settings.assetViewerDir;
    const viewerUrl = assetViewerHref({ base: settings.base, routePrefix, path: asset.path, locale: localeSegment });
    const rawUrl = assetRawHref({ base: settings.base, dir, path: asset.path });
    const dirSegments = asset.dir.split("/").filter(Boolean);
    const indexUrl = ctx.withBase(`/${localeSegment ? `${localeSegment}/` : ""}${routePrefix}/`);
    const homeUrl = ctx.withBase(`/${localeSegment ? `${localeSegment}/` : ""}`);
    const backLink = locale === ctx.defaultLocale
      ? asset.linkedFrom[0]
      : asset.linkedFrom.find((link) => link.locale === locale) ?? asset.linkedFrom[0];
    const breadcrumbItems = [
      { label: "", href: homeUrl },
      { label: t("asset.crumb", locale), ...(settings.assetViewerIndex ? { href: indexUrl } : {}) },
      ...dirSegments.map((label) => ({ label })),
      { label: asset.name },
    ];
    const labels = resolveAssetPageLabels(t, locale);
    const showViewSource = settings.bodyFootUtilArea !== false && settings.bodyFootUtilArea.viewSourceLink !== false;
    const viewSourceUrl = buildGitHubSourceUrl(settings.githubUrl, `public/${dir}`, asset.path);
    const fullPattern = dateFormatsFor(locale).full;
    return (
      <DocLayoutWithDefaults title={composeMetaTitle(asset.name)} head={<>{renderAssetDetailsPrepaintScript()}<HeadWithDefaults title={asset.name} description={asset.description} canonical={ctx.absoluteUrl(viewerUrl)} /></>} lang={locale} dataThemePack={dataThemePack} noindex={settings.noindex} hideSidebar hideToc sidebarOverride={false} contentWide breadcrumbOverride={<BreadcrumbWithDefaults items={breadcrumbItems} />} headerOverride={<HeaderWithDefaults lang={locale} currentPath={viewerUrl} hideSidebarToggle />} footerOverride={<FooterWithDefaults lang={locale} />} bodyEndComponents={<BodyEndIslands basePath={settings.base ?? "/"} forceImageEnlarge={asset.kind === "image" && asset.previewable && asset.sniffOk} />} enableClientRouter={settings.dynamicPageTransition}>
        <AssetPageBody entry={asset} locale={locale} rawUrl={rawUrl} labels={labels} fullPattern={fullPattern} backLink={backLink} viewSourceUrl={viewSourceUrl} showViewSource={showViewSource} />
      </DocLayoutWithDefaults>
    );
  };
}
