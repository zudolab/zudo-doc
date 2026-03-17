/**
 * Resolves the correct dist directory for the smoke fixture.
 * With the Node adapter (aiAssistant: true), static files are at dist/client/.
 * Without it, they're at dist/.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, "fixtures/smoke");

const clientDir = resolve(FIXTURE_DIR, "dist/client");
export const DIST_DIR = existsSync(clientDir)
  ? clientDir
  : resolve(FIXTURE_DIR, "dist");

export function readDistFile(path: string): string {
  return readFileSync(resolve(DIST_DIR, path), "utf-8");
}
