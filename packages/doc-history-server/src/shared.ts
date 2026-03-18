import { resolve } from "node:path";

/** Build list of [localeKey | null, absoluteDir] pairs from content config */
export function getContentDirEntries(
  contentDir: string,
  locales: Array<{ key: string; dir: string }>,
): Array<[string | null, string]> {
  const entries: Array<[string | null, string]> = [
    [null, resolve(contentDir)],
  ];
  for (const locale of locales) {
    entries.push([locale.key, resolve(locale.dir)]);
  }
  return entries;
}
