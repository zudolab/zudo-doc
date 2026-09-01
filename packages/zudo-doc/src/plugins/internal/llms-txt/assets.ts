/**
 * Materialize the shared asset-viewer descriptors for llms.txt output.
 *
 * The descriptor scanner owns the asset-viewer/indexing gates and URL rules;
 * this adapter only reads the bounded text body needed by llms-full.txt.
 * Keeping it separate from the emitter lets build and dev use precisely the
 * same data preparation path.
 */

import { closeSync, openSync, readSync } from "node:fs";
import { resolve } from "node:path";
import { StringDecoder } from "node:string_decoder";

import {
  collectAssetPageDescriptors,
  type AssetPageDescriptor,
  type AssetScanProjection,
} from "../asset-viewer/asset-pages.js";
import {
  LLMS_ASSET_TEXT_CAP_BYTES,
  type LlmsAssetEntry,
} from "./types.js";

export interface LlmsAssetLoadOptions {
  /** Runtime project root supplied by the zfb plugin wrapper. */
  projectRoot?: string;
  /** Shared serialized asset-viewer projection from the preset. */
  assetScan?: AssetScanProjection;
  /** Optional canonical site origin, matching document-entry URL behavior. */
  siteUrl?: string;
}

/**
 * Read at most one byte beyond the inlining cap. The extra byte lets the
 * generator distinguish a body that exactly reaches the cap from one that is
 * truncated, without loading large public assets into memory.
 */
function readTextPrefix(filePath: string): {
  content: string;
  truncated: boolean;
} {
  const sample = Buffer.alloc(LLMS_ASSET_TEXT_CAP_BYTES + 1);
  const fd = openSync(filePath, "r");
  try {
    let offset = 0;
    while (offset < sample.length) {
      const bytesRead = readSync(fd, sample, offset, sample.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    // Do not let Buffer#toString replace a code point that straddles the
    // bounded read. `StringDecoder.write()` deliberately withholds an
    // incomplete trailing sequence; the pure generator can then apply its
    // byte cap without ever seeing a synthetic U+FFFD character.
    const decoder = new StringDecoder("utf8");
    return {
      content: decoder.write(sample.subarray(0, offset)),
      truncated: offset > LLMS_ASSET_TEXT_CAP_BYTES,
    };
  } finally {
    closeSync(fd);
  }
}

function toLlmsAssetEntry(
  descriptor: AssetPageDescriptor,
  projectRoot: string,
  assetScan: AssetScanProjection,
  siteUrl?: string,
): LlmsAssetEntry {
  const url = siteUrl
    ? `${siteUrl.replace(/\/$/, "")}${descriptor.url}`
    : descriptor.url;
  if (!descriptor.isText) {
    return {
      path: descriptor.path,
      url,
      ...(descriptor.locale === undefined ? {} : { locale: descriptor.locale }),
      isText: false,
    };
  }

  const body = readTextPrefix(
    resolve(projectRoot, "public", assetScan.assetViewerDir, descriptor.path),
  );
  return {
    path: descriptor.path,
    url,
    ...(descriptor.locale === undefined ? {} : { locale: descriptor.locale }),
    isText: true,
    content: body.content,
    truncated: body.truncated,
  };
}

/**
 * Collect and materialize all llms-indexed assets. Missing runtime inputs are
 * treated as the legacy no-assets case so direct unit callers and consumers
 * that do not run through zfb remain byte-compatible.
 */
export function loadLlmsAssetEntries(
  options: LlmsAssetLoadOptions,
): LlmsAssetEntry[] {
  const { projectRoot, assetScan, siteUrl } = options;
  if (projectRoot === undefined || assetScan === undefined) return [];

  const descriptors = collectAssetPageDescriptors({
    projectRoot,
    assetScan,
    consumer: "llmsTxt",
  });
  return descriptors.map((descriptor) =>
    toLlmsAssetEntry(descriptor, projectRoot, assetScan, siteUrl),
  );
}
