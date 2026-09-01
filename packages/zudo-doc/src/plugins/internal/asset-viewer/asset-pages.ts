import { closeSync, openSync, readSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import type { AssetViewerIndexingConfig } from "../../../settings.js";
import { assetViewerHref } from "../../../asset-path/index.js";
import { scanAssetsSync } from "./scan.js";

/** The serialized asset-viewer settings shared by index consumers. */
export interface AssetScanProjection {
  assetViewer: boolean;
  assetViewerIndexing: AssetViewerIndexingConfig | false;
  assetViewerDir: string;
  assetViewerRoutePrefix: string;
  assetViewerExclude: readonly string[];
  base: string;
  /** Non-default locales, keyed by locale code. */
  locales: Record<string, { dir?: string }>;
  /** Route prefixes whose generated pages exist only in the default locale. */
  defaultLocaleOnlyPrefixes: readonly string[];
}

/** The asset-page output currently supported by a consumer. */
export type AssetIndexConsumer = keyof AssetViewerIndexingConfig;

/** Minimal normalized descriptor consumed by search, llms.txt, and sitemap. */
export interface AssetPageDescriptor {
  /** NFC-normalized POSIX path relative to `assetViewerDir`. */
  path: string;
  /** Base-prefixed, trailing-slashed generated asset-viewer URL. */
  url: string;
  /** Non-default locale segment; omitted for the default locale. */
  locale?: string;
  /** Whether the asset has a text-like extension understood by the viewer. */
  isText: boolean;
  /** Current byte size of the public asset. */
  size: number;
}

export interface AssetPageDescriptorOptions {
  /** Runtime project root injected by the zfb plugin wrapper. */
  projectRoot: string;
  /** Serialized projection from `zudoDocPreset()`. */
  assetScan?: AssetScanProjection;
  /** The output whose explicit indexing gate must be enabled. */
  consumer: AssetIndexConsumer;
}

// Keep this in step with the viewer's probe categories. The descriptor helper
// remains lightweight and synchronous: it reads at most the first 8 KiB to
// reject an obviously binary payload, but performs no full probe, Git, or
// highlighting work.
const TEXT_EXTENSIONS = new Set([
  "js", "ts", "tsx", "jsx", "mjs", "cjs", "json", "yaml", "yml", "toml",
  "css", "scss", "html", "md", "mdx", "sh", "bash", "py", "rb", "go", "rs",
  "java", "kt", "swift", "c", "h", "cpp", "hpp", "cs", "php", "sql", "xml",
  "txt", "log", "csv", "tsv", "env", "conf", "ini",
]);

function hasBinaryPrefix(absPath: string): boolean {
  const fd = openSync(absPath, "r");
  try {
    const sample = Buffer.allocUnsafe(8 * 1024);
    const bytesRead = readSync(fd, sample, 0, sample.length, 0);
    return sample.subarray(0, bytesRead).includes(0);
  } finally {
    closeSync(fd);
  }
}

function isTextAsset(absPath: string, path: string): boolean {
  const extension = extname(path).slice(1).toLowerCase();
  if (extension.length !== 0 && !TEXT_EXTENSIONS.has(extension)) return false;
  return !hasBinaryPrefix(absPath);
}

function isDefaultLocaleOnlyAsset(
  routePrefix: string,
  path: string,
  prefixes: readonly string[],
): boolean {
  // Use the canonical URL builder even for the prefix-gate check so this
  // helper never grows a second route-construction rule.
  const routePath = assetViewerHref({ base: "/", routePrefix, path });
  return prefixes.some((prefix) => routePath.startsWith(prefix));
}

function hasConsumerGate(
  assetScan: AssetScanProjection,
  consumer: AssetIndexConsumer,
): boolean {
  const indexing = assetScan.assetViewerIndexing;
  return (
    assetScan.assetViewer === true &&
    indexing !== false &&
    typeof indexing === "object" &&
    indexing !== null &&
    indexing[consumer] === true
  );
}

/**
 * Scan the public asset directory and materialize one descriptor per emitted
 * asset page. The default-locale descriptor is emitted first, followed by
 * configured locales in object iteration order. Every descriptor URL is
 * minted by `assetViewerHref()` so encoding, base, and trailing-slash rules
 * cannot diverge between consumers.
 *
 * The descriptor path is intentionally synchronous. Search and llms.txt are
 * synchronous build/dev paths, and `connect-adapter.ts` does not await a
 * middleware's returned promise. Callers must pass the runtime `projectRoot`
 * supplied by the plugin wrapper; it is never part of the serialized preset
 * projection.
 */
export function collectAssetPageDescriptors(
  options: AssetPageDescriptorOptions,
): AssetPageDescriptor[] {
  const { projectRoot, assetScan, consumer } = options;
  if (assetScan === undefined || !hasConsumerGate(assetScan, consumer)) return [];

  const dir = assetScan.assetViewerDir;
  const routePrefix = assetScan.assetViewerRoutePrefix;
  const base = assetScan.base;
  const exclude = assetScan.assetViewerExclude ?? [];
  const paths = scanAssetsSync(projectRoot, dir, exclude);
  const assetRoot = resolve(projectRoot, "public", dir);

  const descriptorFor = (path: string, locale?: string): AssetPageDescriptor => ({
    path,
    url: assetViewerHref({ base, routePrefix, path, ...(locale === undefined ? {} : { locale }) }),
    ...(locale === undefined ? {} : { locale }),
    isText: isTextAsset(resolve(assetRoot, path), path),
    size: statSync(resolve(assetRoot, path)).size,
  });

  const descriptors = paths.map((path) => descriptorFor(path));
  for (const locale of Object.keys(assetScan.locales ?? {})) {
    for (const path of paths) {
      if (isDefaultLocaleOnlyAsset(routePrefix, path, assetScan.defaultLocaleOnlyPrefixes ?? [])) {
        continue;
      }
      descriptors.push(descriptorFor(path, locale));
    }
  }
  return descriptors;
}
