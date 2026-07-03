# claude-resources

Build-time pre-step that scans a project's `.claude/` directory and emits generated MDX pages — one per `CLAUDE.md`, slash command, skill, and subagent — into the doc content collection. Output is byte-equivalent to the Astro integration that lives at `src/integrations/claude-resources/` of the host project; the only thing that changes is the host (Astro `astro:config:setup` hook → zfb pre-build pre-step).

## Surface

```ts
import {
  claudeResourcesPlugin,
  runClaudeResourcesPreStep,
  generateClaudeResourcesDocs,
  CLAUDE_RESOURCES_PLUGIN_NAME,
  type ClaudeResourcesPluginOptions,
  type ZfbPluginConfig,
} from "@takazudo/zudo-doc/integrations/claude-resources";
```

- `claudeResourcesPlugin(options)` — declarative entry returning the `{ name, options }` shape that `zfb.config.ts` consumes via the `plugins` array.
- `runClaudeResourcesPreStep(options)` — imperative runner that resolves relative paths against `projectRoot` (default `process.cwd()`) and invokes the generator.
- `generateClaudeResourcesDocs(config)` — low-level generator. Same signature as the Astro integration's helper. All three accept the same fields; the runner is the convenient wrapper.

### Options

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `claudeDir` | `string` | required | Path to `.claude/` (source of commands/skills/agents). Resolved against `projectRoot` when relative. |
| `projectRoot` | `string` | `process.cwd()` | Anchor for the relative `claudeDir`, `docsDir`, and `scanRoot` paths, and the default value of `scanRoot`. |
| `scanRoot` | `string` | `projectRoot` | Root for **`CLAUDE.md` discovery** and the base for generated pages' relative-path titles/slugs. Resolved against `projectRoot` when relative (absolute allowed). Governs `CLAUDE.md` discovery **only** — commands/skills/agents always come from `claudeDir`. |
| `docsDir` | `string` | `src/content/docs` | Output directory for generated MDX. Resolved against `projectRoot` when relative. |

#### Anchor precedence

All three relative inputs (`claudeDir`, `docsDir`, `scanRoot`) resolve against `projectRoot`. `scanRoot` then becomes the walk / relative-path base for `CLAUDE.md` discovery, decoupled from the output base (`docsDir`). When `scanRoot` is unset it equals `projectRoot`, so single-root projects behave exactly as before.

#### Subdirectory-monorepo doc sites (`scanRoot`)

When the doc site lives in a **subdirectory** of the repo but should surface `CLAUDE.md` files from the repo root and sibling packages, set `scanRoot` to widen discovery without moving the generated output out of the doc package:

```ts
// settings.claudeResources — doc site in <repo>/docs-site, .claude at repo root
claudeResources: { claudeDir: "../.claude", scanRoot: ".." }
```

- Output still lands in the doc site's own `docsDir` (anchored to `projectRoot`, which in the preset/plugin path defaults to `ctx.projectRoot` — the doc-site root). Omitting `projectRoot` as above is the most robust form; the imperative `runClaudeResourcesPreStep` runner instead defaults `projectRoot` to `process.cwd()`.
- `scanRoot: ".."` makes the `CLAUDE.md` walk start at the repo root, so repo-root and sibling-package `CLAUDE.md` files are discovered and titled relative to the repo root (e.g. `/CLAUDE.md`, `/app/CLAUDE.md`).
- Note: with `scanRoot` at the repo root the discovery walk's exclude list (`.git`, `node_modules`, `dist`, `out`, `public`, `worktrees`, `__inbox`, `test-results`, `e2e/fixtures`, and the `docsDir` itself) re-anchors there, so a per-subdirectory build output in another package is no longer excluded from the walk. In practice this is negligible — only files literally named `CLAUDE.md` are collected and dotdirs/`node_modules` are always skipped — but repo-wide scanning is heavier and will surface sibling-package `CLAUDE.md` files, which is the intended aggregation.

## Registration in zfb.config.ts

Add the plugin to the `plugins` array. The manager wires this in at merge time — do not edit `zfb.config.ts` from this topic branch.

```ts
import { defineConfig } from "zfb/config";
import { claudeResourcesPlugin } from "@takazudo/zudo-doc/integrations/claude-resources";

export default defineConfig({
  // ...other config
  plugins: [
    claudeResourcesPlugin({
      claudeDir: ".claude",
      // projectRoot defaults to process.cwd()
      // docsDir defaults to "src/content/docs"
    }),
  ],
});
```

### v0 host wiring

zfb v0 accepts the `plugins` array but does not yet invoke plugin lifecycles, so registering the plugin alone does not run generation today. Until the lifecycle hook lands, the host invokes the imperative runner from a `prebuild`-style script so generation completes before zfb scans content collections:

```ts
// scripts/prebuild-claude-resources.ts
import { runClaudeResourcesPreStep } from "@takazudo/zudo-doc/integrations/claude-resources";

const counts = runClaudeResourcesPreStep({
  claudeDir: ".claude",
});

console.log(
  `claude-resources: ${counts.claudemd} CLAUDE.md, ${counts.commands} commands, ${counts.skills} skills, ${counts.agents} agents`,
);
```

```jsonc
// package.json
{
  "scripts": {
    "prebuild": "tsx scripts/prebuild-claude-resources.ts",
    "build": "zfb build"
  }
}
```

The plugin entry stays in `zfb.config.ts` so a later zfb release can pick up the registration without a host change. Once zfb invokes plugin lifecycles, the imperative runner and the prebuild script can be dropped.

## Outputs

The pre-step writes the following under `<docsDir>` (default `src/content/docs`):

```
claude/index.mdx                     # overview page (sidebar_position 899)
claude-md/_category_.json            # CLAUDE.md category, position 900
claude-md/<slug>.mdx                 # one per CLAUDE.md found under projectRoot
claude-commands/_category_.json      # Commands category, position 901
claude-commands/<name>.mdx           # one per .claude/commands/*.md
claude-skills/_category_.json        # Skills category, position 902
claude-skills/<dir>.mdx              # one per .claude/skills/<dir>/SKILL.md
claude-skills/<dir>--ref-<name>.mdx  # one per references/*.md inside the skill
claude-skills/<dir>--script-<name>.mdx  # one per scripts/*.md inside the skill
claude-skills/<dir>--asset-<name>.mdx   # one per assets/*.md inside the skill
claude-agents/_category_.json        # Agents category, position 903
claude-agents/<name>.mdx             # one per .claude/agents/*.md
```

The discovery walk for `CLAUDE.md` excludes `.git/`, `node_modules/`, `worktrees/`, and the `docsDir` itself so generated output never feeds back into the next run.

## Coexistence with the Astro integration

The Astro integration at `src/integrations/claude-resources/` of the host repo is intentionally left in place during the migration so sibling topics can keep building under Astro. This zfb pre-step shares the underlying `generate.ts` / `escape-for-mdx.ts` logic byte-for-byte; switching from one host to the other does not change the generated MDX.
