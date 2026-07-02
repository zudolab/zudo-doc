/**
 * Resolves the correct dist directory for a given e2e fixture, and reads
 * files from it.
 * With the Node adapter (aiAssistant: true), static files are at
 * dist/client/. Without it, they're at dist/.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface DistReader {
  /** Resolved dist directory for the fixture (dist/client/ or dist/). */
  readonly DIST_DIR: string;
  /** Reads a file at `path` (relative to DIST_DIR) as utf-8 text. */
  readDistFile(path: string): string;
}

/**
 * Builds a { DIST_DIR, readDistFile } pair scoped to one e2e fixture
 * (e.g. "smoke", "versioning") — see e2e/CLAUDE.md for the full fixture
 * list and their build/preview topology.
 */
export function makeDistReader(fixtureName: string): DistReader {
  const fixtureDir = resolve(__dirname, "fixtures", fixtureName);
  const clientDir = resolve(fixtureDir, "dist/client");
  const DIST_DIR = existsSync(clientDir) ? clientDir : resolve(fixtureDir, "dist");

  return {
    DIST_DIR,
    readDistFile(path: string): string {
      return readFileSync(resolve(DIST_DIR, path), "utf-8");
    },
  };
}
