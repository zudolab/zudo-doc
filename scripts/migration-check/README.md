# scripts/migration-check/

Migration-check harness for the zfb Astro adapter cutover.

Compares a "before" build (default: `origin/main`) against an "after" build
(default: `HEAD`) by spinning up both sites locally, crawling every route, and
diffing the rendered HTML.

## Quick start

```sh
# Full run (build both sides, compare, report)
node scripts/migration-check/run.mjs
```

Individual steps are in separate scripts (S2–S8); see the epic issue for the
full sub-task breakdown.

## Shared config

All constants (ports, workspace paths, batch sizes, cosmetic markers) live in
`config.mjs`. Import from there — do not hard-code values in individual steps.

## Full documentation

Once the SKILL.md lands (sub-task S9), detailed usage notes will be in
`.claude/skills/migration-check/SKILL.md`.

## Workspace directory

The harness writes all artifacts to `.l-zfb-migration-check/` (gitignored).
Delete it to start a clean run.
