import { readFile, stat } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import type { AssetIndexEntry, AssetManifest } from "../../../route-context-payload/types.js";
import { assetGitMeta } from "./git-meta.js";
import {
  highlightAsset,
  renderExcerpt,
  withLineIds,
  type HighlightCode,
} from "./highlight.js";
import {
  collectAssetLinks,
  type AssetLinkContentRoot,
} from "./link-graph.js";
import { probeAsset } from "./probe.js";
import { scanAssets } from "./scan.js";
import { readSidecar } from "./sidecar.js";
import type { AssetRecord, AssetRecords } from "./types.js";

const MANIFEST_WARNING_BYTES = 256 * 1024;

export interface AssetSnapshotLogger {
  warn(message: string): void;
}

export interface BuildAssetSnapshotOptions {
  projectRoot: string;
  dir: string;
  routePrefix: string;
  exclude: readonly string[];
  contentRoots: readonly AssetLinkContentRoot[];
  base: string;
  trailingSlash: boolean;
  logger: AssetSnapshotLogger;
  highlightCode: HighlightCode;
}

export interface AssetSnapshot {
  manifest: AssetManifest;
  records: AssetRecords;
  watchFiles: string[];
}

/** Assemble the author-facing manifest and the route-private full records. */
export async function buildAssetSnapshot({
  projectRoot,
  dir,
  routePrefix,
  exclude,
  contentRoots,
  base,
  trailingSlash,
  logger,
  highlightCode,
}: BuildAssetSnapshotOptions): Promise<AssetSnapshot> {
  const paths = await scanAssets(projectRoot, dir, exclude);
  const assetRoot = resolve(projectRoot, "public", dir);
  const watchFiles = paths.map((path) => resolve(assetRoot, path));
  const [gitMeta, linkGraph] = await Promise.all([
    assetGitMeta(projectRoot, dir),
    Promise.resolve(collectAssetLinks({ contentRoots, dir, base, trailingSlash })),
  ]);

  const entries: AssetIndexEntry[] = [];
  const records: AssetRecords = {};
  const sourceByPath = new Map<string, string>();

  for (const path of paths) {
    const absPath = resolve(assetRoot, path);
    const [fileStat, probe, sidecar] = await Promise.all([
      stat(absPath),
      probeAsset(absPath),
      readSidecar(absPath),
    ]);
    const entry: AssetIndexEntry = {
      path,
      name: sidecar?.title ?? basename(path),
      dir: dirname(path) === "." ? "" : dirname(path),
      kind: probe.kind,
      mime: probe.mime,
      ...(probe.language === undefined ? {} : { language: probe.language }),
      bytes: fileStat.size,
      ...(probe.lines === undefined ? {} : { lines: probe.lines }),
      ...(probe.width === undefined ? {} : { width: probe.width }),
      ...(probe.height === undefined ? {} : { height: probe.height }),
      ...(probe.durationSec === undefined ? {} : { durationSec: probe.durationSec }),
      ...(sidecar?.description === undefined ? {} : { description: sidecar.description }),
    };
    entries.push(entry);

    let body: Awaited<ReturnType<typeof highlightAsset>> | undefined;
    let plain: string | undefined;
    if (probe.sniffOk && (probe.kind === "code" || probe.kind === "text")) {
      plain = await readFile(absPath, "utf8");
      sourceByPath.set(path, plain);
      body = await highlightAsset(plain, probe.language ?? "text", highlightCode);
    }
    const meta = gitMeta[path];
    const record: AssetRecord = {
      ...entry,
      sniffOk: probe.sniffOk,
      ...(meta?.createdDate === undefined ? {} : { createdDate: meta.createdDate }),
      ...(meta?.updatedDate === undefined ? {} : { updatedDate: meta.updatedDate }),
      ...(meta?.author === undefined ? {} : { author: meta.author }),
      linkedFrom: linkGraph.linkedFrom.get(path) ?? [],
      truncated: body?.truncated ?? false,
      previewable:
        body?.previewable ??
        (probe.sniffOk && ["image", "video", "pdf"].includes(probe.kind)),
      ...(body?.html == null ? {} : { html: withLineIds(body.html) }),
      ...(plain === undefined || body?.previewable !== true ? {} : { plain }),
    };
    records[path] = record;
  }

  const excerpts: AssetManifest["excerpts"] = {};
  for (const request of linkGraph.excerptRequests) {
    const source = sourceByPath.get(request.path);
    const record = records[request.path];
    if (source === undefined || record?.lines === undefined) continue;
    const end = request.end ?? record.lines;
    const excerpt = await renderExcerpt(
      source,
      record.language ?? "text",
      request.start,
      end,
      record.lines,
      highlightCode,
    );
    excerpts[`${request.path}#${request.start}-${end}`] = excerpt;
  }

  const manifest: AssetManifest = { dir, routePrefix, entries, excerpts };
  const manifestBytes = Buffer.byteLength(JSON.stringify(manifest));
  if (manifestBytes > MANIFEST_WARNING_BYTES) {
    logger.warn(
      `[asset-viewer] route manifest is ${manifestBytes} bytes (recommended maximum ${MANIFEST_WARNING_BYTES} bytes)`,
    );
  }
  return { manifest, records, watchFiles };
}
