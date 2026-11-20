/**
 * `docSources` entries the scaffold emits for the `claudeCodeDocs` and
 * `codexDocs` feature choices. Each feature adds one bundled-preset entry to
 * the single `docSources` array (`@takazudo/zudo-doc`'s
 * `DocSourcePresetEntry`); the id doubles as the mount, so the routes are
 * `/docs/claude/...` and `/docs/codex/...`.
 *
 * Shared by `zfb-config-gen.ts` (the config field + header navigation) and
 * `scaffold.ts` (the `dev` watcher script + `.gitignore` output entries).
 */
export interface ScaffoldDocSource {
  id: string;
  preset: "claude-code" | "codex";
  root: string;
}

export const DOC_SOURCE_NAV_LABELS: Record<ScaffoldDocSource["preset"], string> = {
  "claude-code": "Claude",
  codex: "Codex",
};

export function resolveDocSources(features: readonly string[]): ScaffoldDocSource[] {
  const sources: ScaffoldDocSource[] = [];
  if (features.includes("claudeCodeDocs")) {
    sources.push({ id: "claude", preset: "claude-code", root: ".claude" });
  }
  if (features.includes("codexDocs")) {
    sources.push({ id: "codex", preset: "codex", root: ".codex" });
  }
  return sources;
}
