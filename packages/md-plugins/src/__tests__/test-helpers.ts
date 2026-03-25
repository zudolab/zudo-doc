import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

/** Create a unique temporary directory for testing. */
export function createTempProject(): string {
  const dir = resolve(
    tmpdir(),
    `md-plugins-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Create a file (and parent dirs) with minimal markdown content. */
export function touch(base: string, filePath: string): void {
  const full = resolve(base, filePath);
  mkdirSync(resolve(full, ".."), { recursive: true });
  writeFileSync(full, "# Test");
}

/** Remove a temporary directory. */
export function cleanupTempProject(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
