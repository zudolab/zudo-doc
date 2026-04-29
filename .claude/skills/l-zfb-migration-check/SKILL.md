---
name: l-zfb-migration-check
description: Run the zfb migration-check harness to compare two build snapshots (before/after a framework migration) and surface regressions. Use when migrating Astro → zfb (or any zudo-style framework migration) to verify no visual/structural regressions were introduced.
---

# l-zfb-migration-check

Compare two build snapshots of the site and produce a regression report. Designed for framework migrations (Astro → zfb, or any future framework swap) in zudo-style projects.

## When to Use

- Before merging a migration branch — verify no visual or structural regressions slipped through
- After a large refactor that touches routing, layout, or asset pipeline
- Any time you need a side-by-side HTML/artifact diff across two git refs

## Prerequisites

- `gh` CLI authenticated (`gh auth status`)
- `pnpm` available
- Both `--from-ref` and `--to-ref` must be reachable in the local repo (`git fetch` first if needed)
- Sufficient disk space for two full site snapshots (~200 MB–2 GB depending on project size)
- Ports 4400 and 4401 free (or override with `--port-a` / `--port-b`)

## Invocation

Preferred — runs the harness directly without Claude in the bulk loop:

```bash
node scripts/migration-check/run.mjs [flags]
```

npm script alias:

```bash
pnpm migration-check [flags]
```

## Args Reference

All flags use `--flag=value` form (no space between flag and value).

| Flag | Default | Description |
|------|---------|-------------|
| `--from-ref=<ref>` | `origin/main` | Git ref for snapshot A (baseline / "before") |
| `--to-ref=<ref>` | `HEAD` | Git ref for snapshot B (candidate / "after") |
| `--no-build` | false | Skip build phase; requires both snapshots already on disk |
| `--no-serve` | false | Skip server startup; assumes servers already bound on the configured ports |
| `--baseline-only` | false | Build only snapshot A (skip B) |
| `--current-only` | false | Build only snapshot B (skip A) |
| `--rerun` | false | Re-compare without rebuilding: skips build if both snapshots exist, reuses servers if both ports are bound, wipes findings and report first |
| `--raise-issues` | false | (reserved, S7+) Raise GitHub issues for detected regressions |
| `--batch-size=<n>` | `30` | Number of routes per compare-routes batch |
| `--max-concurrent=<n>` | `6` | Max concurrent batch child processes |
| `--site-prefix=<str>` | `/pj/zudo-doc/` | URL path prefix of the deployed site; override per project |
| `--port-a=<n>` | `4400` | Port for snapshot A static server |
| `--port-b=<n>` | `4401` | Port for snapshot B static server |

Environment variable alternative: `MIGRATION_SITE_PREFIX=<str>` overrides `--site-prefix`.

## Output Locations

All output is written under `.l-zfb-migration-check/` (gitignored workspace):

| Path | Contents |
|------|----------|
| `.l-zfb-migration-check/snapshots/a/` | Static build snapshot for `--from-ref` |
| `.l-zfb-migration-check/snapshots/b/` | Static build snapshot for `--to-ref` |
| `.l-zfb-migration-check/findings/` | Per-URL diff findings (one JSON file per batch) |
| `.l-zfb-migration-check/report.md` | Human-readable regression report |
| `.l-zfb-migration-check/routes.json` | Discovered routes (inBoth / onlyInA / onlyInB) |
| `.l-zfb-migration-check/artifacts.json` | Non-HTML artifact diffs (CSS, JS, sitemap, etc.) |

## Port-Collision Handling

The harness uses **bind-attempt fail-fast**: it calls `server.listen()` on the configured port and relies on the OS to reject with `EADDRINUSE` if the port is already taken. No external lock file is needed — the TCP bind is itself an atomic lock. If you hit a port conflict, either stop the conflicting process or pass `--port-a` / `--port-b` to use different ports.

## Iteration Loop

```
1. Run:          pnpm migration-check
2. Review:       open .l-zfb-migration-check/report.md
3. Fix regressions in a separate /x-wt-teams session (one sub-task per cluster)
4. Re-compare:   pnpm migration-check --rerun        # skip rebuild, wipe findings
5. Confirm:      regression cluster count should shrink each iteration
6. Repeat until report.md shows zero regressions (or only cosmetic findings)
```

Use `--rerun` for rapid iteration after fixes — it skips the expensive rebuild and reuses the already-running static servers. Use `--no-build` when you want to skip the build but restart the servers.

## Reusability

This harness is **framework-agnostic** and works for any zudo-style project migration:

- Override `--from-ref` and `--to-ref` to point at the refs relevant to your migration
- Override `--site-prefix` (or set `MIGRATION_SITE_PREFIX`) to match your project's deployed URL prefix
- Framework detection is automatic (S2 reads config-file presence to detect Astro vs zfb vs future adapters) — no harness changes needed when switching build tools

To run the same harness on a different project, clone the `scripts/migration-check/` directory alongside the target repo's source and set `--site-prefix` accordingly.

## Pipeline Phases (for reference)

The harness runs these phases in order:

1. **Build snapshots** — checks out each ref into a temp worktree and runs the build
2. **Start servers** — serves both snapshot dirs on `--port-a` and `--port-b`
3. **Discover routes + diff artifacts** — crawls sitemaps, writes `routes.json` and `artifacts.json`
4. **Batch-compare routes** — splits `inBoth` routes into batches, spawns `compare-routes.mjs` per batch with concurrency cap
5. **Aggregate findings** — merges batch JSONs into `report.md` (S7)
6. **Cleanup** — stops servers, prints summary
