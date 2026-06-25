// github-helpers — parameterized GitHub URL builder (epic #2344, S7).
//
// The host's `src/utils/github.ts` previously read `settings.githubUrl`
// at module scope. This factory receives the githubUrl as an argument so
// the logic lives in the package while the host stub keeps the singleton.
//
// Pure functions — no node builtins, no host alias imports.

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Build the GitHub repository root URL, or null if githubUrl is not configured.
 *
 * Parameterized version of the host's `buildGitHubRepoUrl()`.
 */
export function buildGitHubRepoUrl(githubUrl: string | false | null | undefined): string | null {
  if (!githubUrl) return null;
  return trimTrailingSlash(githubUrl as string);
}

/**
 * Build a view-source GitHub URL pointing at a content file, or null when
 * githubUrl is not set.
 *
 * Parameterized version of the host's `buildGitHubSourceUrl(contentDir, entryId)`.
 *
 * @param githubUrl  - The repository base URL (e.g. `settings.githubUrl`).
 * @param contentDir - Content directory relative to the repo root (e.g. "src/content/docs").
 * @param entryId    - File path within contentDir (e.g. "getting-started/intro.mdx").
 */
export function buildGitHubSourceUrl(
  githubUrl: string | false | null | undefined,
  contentDir: string,
  entryId: string,
): string | null {
  const repoUrl = buildGitHubRepoUrl(githubUrl);
  if (!repoUrl) return null;
  return `${repoUrl}/blob/HEAD/${contentDir}/${entryId}`;
}
