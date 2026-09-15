// Transient snapshot dirs that CLI tests create INSIDE the package root and delete
// while other test files run. They must stay there — the copied bin resolves bare
// deps from this package's node_modules — so every test that cpSyncs the whole
// package root must skip them or race into ENOENT (#4230, #4233). A new in-package
// snapshot prefix belongs here, imported by its creator.
import { basename } from "node:path";

export const CLI_SMOKE_SNAPSHOT_PREFIX = ".cli-snapshot-";
export const CHECK_IMAGES_CLI_SNAPSHOT_PREFIX = ".check-images-cli-snapshot-";

export const IN_PACKAGE_TEST_SNAPSHOT_PREFIXES = [
  CLI_SMOKE_SNAPSHOT_PREFIX,
  CHECK_IMAGES_CLI_SNAPSHOT_PREFIX,
] as const;

export function isInPackageTestSnapshot(source: string): boolean {
  const name = basename(source);
  return IN_PACKAGE_TEST_SNAPSHOT_PREFIXES.some((prefix) => name.startsWith(prefix));
}
