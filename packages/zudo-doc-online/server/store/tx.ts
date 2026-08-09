/**
 * Staged multi-file commits for one project directory.
 *
 * A single logical edit routinely touches three files — `outline.json`, a page
 * file, and the revision in `project.json`. Writing them one by one means a
 * crash can leave the outline referencing a page file that was never created,
 * or a revision that claims work the disk does not have.
 *
 * The commit therefore has two phases:
 *
 *   1. stage — every new file body is written under `.tx-staging/next/`, and a
 *      copy of every live file the commit will disturb goes to
 *      `.tx-staging/prev/`. Nothing live has moved yet.
 *   2. apply — the staged files are renamed into place (rename is atomic per
 *      file), with the revision-bearing `project.json` renamed LAST.
 *
 * Renaming `project.json` last is what makes a partial commit *detectable*:
 * the revision on disk is the pre-commit one until the very last rename, so
 * recovery can compare it against the manifest and tell "aborted" from
 * "finished but not cleaned up". An aborted commit is rolled back from
 * `prev/`, which is why the pre-commit state is authoritative.
 *
 * This module is the only place besides `file-store.ts` that touches `node:fs`
 * (epic #3327: Node APIs stay behind the store seam so the HTTP layer stays
 * portable).
 */

import { constants as fsConstants } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export const STAGING_DIR = ".tx-staging";
export const STAGING_NEXT_DIR = "next";
export const STAGING_PREV_DIR = "prev";
export const STAGING_MANIFEST = "commit.json";

/** Renamed last; its revision field is the commit's completion marker. */
export const PROJECT_FILE = "project.json";

export interface StagedMove {
  /** Project-relative path of the live file being moved. */
  from: string;
  /** Project-relative destination (always inside `trash/`). */
  to: string;
}

export interface CommitManifest {
  baseRevision: number;
  nextRevision: number;
  /** Every live path the commit disturbs — the rollback work list. */
  paths: string[];
}

export type RecoveryOutcome =
  /** No staging directory: nothing to do. */
  | "none"
  /** Staging existed but the commit had not started applying. */
  | "discarded"
  /** The commit finished; only the staging cleanup was missing. */
  | "completed"
  /** The commit was interrupted mid-apply; the pre-commit state was restored. */
  | "rolled-back";

/**
 * Collects the file changes of one logical edit, then commits them together.
 * Instances are single-use and are always constructed and committed inside the
 * project's mutex.
 */
export class Transaction {
  private readonly writes = new Map<string, string>();
  private readonly moves: StagedMove[] = [];

  constructor(
    private readonly projectDir: string,
    private readonly baseRevision: number,
    private readonly nextRevision: number,
  ) {}

  /** Queues a file body. A repeated path replaces the earlier queued body. */
  write(relPath: string, contents: string): void {
    this.writes.set(normalizeRel(relPath), contents);
  }

  /**
   * Queues a move of a live file. Used only for trashing — the store never
   * hard-deletes content, so a removal is a move into `trash/`.
   */
  move(from: string, to: string): void {
    this.moves.push({ from: normalizeRel(from), to: normalizeRel(to) });
  }

  get isEmpty(): boolean {
    return this.writes.size === 0 && this.moves.length === 0;
  }

  async commit(): Promise<void> {
    if (this.isEmpty) return;

    const staging = path.join(this.projectDir, STAGING_DIR);
    const nextDir = path.join(staging, STAGING_NEXT_DIR);
    const prevDir = path.join(staging, STAGING_PREV_DIR);

    // A leftover directory here would mean recovery did not run; clearing it
    // is safe because recovery has already had its chance under the mutex.
    await rm(staging, { recursive: true, force: true });
    await mkdir(nextDir, { recursive: true });
    await mkdir(prevDir, { recursive: true });

    for (const [rel, contents] of this.writes) {
      const target = path.join(nextDir, rel);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, contents, "utf8");
    }

    const paths = [...this.writes.keys(), ...this.moves.map((move) => move.from)];
    for (const rel of paths) {
      const live = path.join(this.projectDir, rel);
      const backup = path.join(prevDir, rel);
      await mkdir(path.dirname(backup), { recursive: true });
      // COPYFILE_EXCL is not wanted here — a duplicate path in `paths` should
      // simply back the same content up twice.
      await copyFile(live, backup).catch(ignoreMissing);
    }

    const manifest: CommitManifest = {
      baseRevision: this.baseRevision,
      nextRevision: this.nextRevision,
      paths: [...new Set(paths)],
    };
    // The manifest is the point of no return: before it exists, recovery can
    // discard staging knowing nothing live was touched.
    await writeFile(
      path.join(staging, STAGING_MANIFEST),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );

    for (const move of this.moves) {
      const to = path.join(this.projectDir, move.to);
      await mkdir(path.dirname(to), { recursive: true });
      await rename(path.join(this.projectDir, move.from), to).catch(ignoreMissing);
    }

    for (const rel of this.writes.keys()) {
      if (rel === PROJECT_FILE) continue;
      await promote(nextDir, this.projectDir, rel);
    }
    if (this.writes.has(PROJECT_FILE)) {
      await promote(nextDir, this.projectDir, PROJECT_FILE);
    }

    await rm(staging, { recursive: true, force: true });
  }
}

/**
 * Resolves a leftover `.tx-staging/` in `projectDir`. Safe to call on every
 * open — it is a single `readFile` when there is nothing to recover.
 */
export async function recoverStagedCommit(
  projectDir: string,
): Promise<RecoveryOutcome> {
  const staging = path.join(projectDir, STAGING_DIR);
  const manifest = await readManifest(path.join(staging, STAGING_MANIFEST));

  if (manifest === "absent") return "none";
  if (manifest === "unusable") {
    // No usable manifest ⇒ the commit never reached its point of no return,
    // so no live file was touched and the staged bodies are simply dropped.
    await rm(staging, { recursive: true, force: true });
    return "discarded";
  }

  const revision = await readCommittedRevision(path.join(projectDir, PROJECT_FILE));
  if (revision === manifest.nextRevision) {
    // `project.json` was renamed last, so its new revision proves every other
    // rename already happened. Only the cleanup was missing.
    await rm(staging, { recursive: true, force: true });
    return "completed";
  }

  const prevDir = path.join(staging, STAGING_PREV_DIR);
  for (const rel of manifest.paths) {
    const live = path.join(projectDir, rel);
    const backup = path.join(prevDir, rel);
    const restored = await copyFile(backup, live).then(
      () => true,
      (error: unknown) => {
        if (isMissing(error)) return false;
        throw error;
      },
    );
    // No backup means the file did not exist before the commit, so the
    // pre-commit state is "absent" and any partially-created file must go.
    if (!restored) await rm(live, { force: true });
  }

  await rm(staging, { recursive: true, force: true });
  return "rolled-back";
}

/**
 * Renames a staged file over its live path. `rename` replaces the destination
 * atomically on POSIX, so a reader sees either the old file or the new one.
 */
async function promote(
  nextDir: string,
  projectDir: string,
  rel: string,
): Promise<void> {
  const live = path.join(projectDir, rel);
  await mkdir(path.dirname(live), { recursive: true });
  await rename(path.join(nextDir, rel), live);
}

async function readManifest(
  manifestPath: string,
): Promise<CommitManifest | "absent" | "unusable"> {
  let raw: string;
  try {
    raw = await readFile(manifestPath, "utf8");
  } catch (error) {
    if (isMissing(error)) {
      // Distinguishes "no staging at all" from "staging without a manifest":
      // the first is the normal case, the second is an aborted stage.
      return (await exists(path.dirname(manifestPath))) ? "unusable" : "absent";
    }
    throw error;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CommitManifest>;
    if (
      typeof parsed.baseRevision !== "number" ||
      typeof parsed.nextRevision !== "number" ||
      !Array.isArray(parsed.paths) ||
      parsed.paths.some((entry) => typeof entry !== "string")
    ) {
      return "unusable";
    }
    return {
      baseRevision: parsed.baseRevision,
      nextRevision: parsed.nextRevision,
      paths: parsed.paths,
    };
  } catch {
    return "unusable";
  }
}

/**
 * Returns the revision `project.json` currently claims, or null when the file
 * is missing or unreadable — both of which mean "the commit did not finish".
 */
async function readCommittedRevision(projectPath: string): Promise<number | null> {
  try {
    const parsed = JSON.parse(await readFile(projectPath, "utf8")) as {
      revision?: unknown;
    };
    return typeof parsed.revision === "number" ? parsed.revision : null;
  } catch {
    return null;
  }
}

async function exists(target: string): Promise<boolean> {
  return access(target, fsConstants.F_OK).then(
    () => true,
    () => false,
  );
}

/** Project-relative, POSIX-separated, and provably inside the project. */
function normalizeRel(relPath: string): string {
  const normalized = path.posix.normalize(relPath.split(path.sep).join("/"));
  if (
    normalized.startsWith("/") ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    throw new Error(`Transaction path escapes the project directory: ${relPath}`);
  }
  return normalized;
}

function ignoreMissing(error: unknown): void {
  if (!isMissing(error)) throw error;
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
}
