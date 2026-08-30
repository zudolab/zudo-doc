import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { normalizeAssetPath } from "../../../asset-path/index.js";

export interface AssetGitMetaEntry {
  createdDate: string;
  updatedDate: string;
  author: string;
}

const execFileAsync = promisify(execFile);

/** Collect first/last Git metadata in one bounded history walk. */
export async function assetGitMeta(
  projectRoot: string,
  dir: string,
): Promise<Record<string, AssetGitMetaEntry>> {
  if (process.env.SKIP_DOC_HISTORY === "1") return {};
  const assetRoot = resolve(projectRoot, "public", dir);
  try {
    // The shared history walker intentionally discovers its repository from
    // process.cwd(). Probe this explicit project first so an unrelated parent
    // checkout cannot make a non-Git consumer look tracked.
    await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: projectRoot,
      encoding: "utf8",
    });
    // The history server is an optional peer. Keep it out of the eagerly
    // loaded routes-plugin graph so consumers that do not enable the asset
    // viewer can build from the packed package without installing it.
    const { getAllFilesFirstLastMetaAsync } = await import(
      "@takazudo/zudo-doc-history-server/git-history"
    );
    const history = await getAllFilesFirstLastMetaAsync([assetRoot]);
    const result: Record<string, AssetGitMetaEntry> = {};
    for (const [absPath, entry] of history) {
      const prefix = assetRoot.endsWith("/") ? assetRoot : `${assetRoot}/`;
      if (!absPath.startsWith(prefix)) continue;
      let path: string;
      try {
        path = normalizeAssetPath(absPath.slice(prefix.length));
      } catch {
        continue;
      }
      result[path] = {
        createdDate: entry.oldest.date,
        updatedDate: entry.newest.date,
        author: entry.oldest.author,
      };
    }
    return result;
  } catch (error) {
    console.debug("[asset-viewer] Git metadata unavailable", error);
    return {};
  }
}
