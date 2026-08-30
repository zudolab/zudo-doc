/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";
import recordsValue from "virtual:zudo-doc-asset-bodies";
import { DocLayoutWithDefaults } from "../doclayout/index.js";
import { resolveThemePackSsrSlug } from "../theme/theme-pack-provider.js";
import { assetViewerHref } from "../asset-path/index.js";
import type { AssetRecords } from "../plugins/internal/asset-viewer/types.js";
import {
  assetManifest,
  defaultLocale,
  settings,
  themePackRegistry,
} from "./_context.js";
import {
  BodyEndIslands,
  FooterWithDefaults,
  HeaderWithDefaults,
  HeadWithDefaults,
  composeMetaTitle,
} from "./_chrome.js";

export const frontmatter = { title: "Files" };

export function paths(): Array<{
  params: { path: string[] };
  props: { path: string };
}> {
  return (assetManifest?.entries ?? []).map((entry) => ({
    params: { path: entry.path.split("/") },
    props: { path: entry.path },
  }));
}

export default function FilesPathPage({ path }: { path: string }): JSX.Element {
  const records = recordsValue as AssetRecords;
  const record = records[path];
  const name = record?.name ?? path.split("/").at(-1) ?? path;
  const locale = defaultLocale;
  const viewerHref = assetViewerHref({
    base: settings.base,
    routePrefix: assetManifest?.routePrefix ?? settings.assetViewerRoutePrefix,
    path,
  });

  return (
    <DocLayoutWithDefaults
      title={composeMetaTitle(name)}
      head={<HeadWithDefaults title={name} />}
      lang={locale}
      dataThemePack={resolveThemePackSsrSlug(themePackRegistry, settings)}
      noindex={settings.noindex}
      hideSidebar={true}
      hideToc={true}
      sidebarOverride={<></>}
      contentWide={true}
      headerOverride={<HeaderWithDefaults lang={locale} />}
      footerOverride={<FooterWithDefaults lang={locale} />}
      bodyEndComponents={<BodyEndIslands basePath={settings.base ?? "/"} />}
      enableClientRouter={settings.dynamicPageTransition}
    >
      <p>
        Asset preview placeholder:{" "}
        <a href={viewerHref} class="hover:underline focus-visible:underline">
          {name}
        </a>{" "}
        ({record?.bytes ?? 0} bytes).
      </p>
    </DocLayoutWithDefaults>
  );
}
