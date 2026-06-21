---
name: l-bump-deps
description: >-
  Bump zudo-doc's first-party @takazudo/* build toolchain — the zfb family
  (@takazudo/zfb, -runtime, -adapter-cloudflare) and @takazudo/zdtp — to the latest
  published versions across every pin location, install, and verify. Use when: (1) User
  says '/l-bump-deps', 'bump deps', 'bump the toolchain', 'update zfb', 'update zdtp', or
  'update the @takazudo packages to latest', (2) A new zfb / zdtp prerelease has shipped
  and this repo should adopt it, (3) Routine dependency-update rounds for the upstream SSG
  toolchain. This is the CONSUMER side — it only adopts already-published versions. It does
  an in-place bump in the working tree (no branch/PR of its own) so the standard follow-up
  is `/commits push` then `/l-make-release` (a scaffold-pin bump warrants a create-zudo-doc
  release). To edit zfb's OWN source instead, use /l-zfb-upstream-dev.
user-invocable: true
argument-hint: "[package names | \"all\" (default)] [--no-release]"
---

# l-bump-deps — Bump the @takazudo/\* toolchain to latest

Bump this repo's upstream build toolchain to the newest published versions, keep every pin
location in lockstep, prove the bump builds, and hand off cleanly to commit + release.

> Producer vs consumer: **`/l-zfb-upstream-dev`** changes zfb's _own_ code (worktree →
> upstream PR → publish a prerelease). **This skill** only consumes already-published
> versions. A zfb-upstream-dev session ends where this one begins ("bump the npm pins").

## What to bump (the package families)

zfb prerelease pins are **exact** (`0.1.0-next.N`, no caret) and the zfb family must move
together. zdtp moves on its own cadence (stable `0.2.x`).

| Family | Packages (npm)                                                        | Move together? |
| ------ | --------------------------------------------------------------------- | -------------- |
| zfb    | `@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-adapter-cloudflare` | Yes — same `next.N` |
| zdtp   | `@takazudo/zdtp`                                                       | Independent     |

## What NOT to bump (we PRODUCE these)

`@takazudo/zudo-doc` and `@takazudo/zudo-doc-history-server` are published **from this
monorepo** — they are not upstream deps. Their version is this repo's own `package.json`
`version`, advanced by the release flow (`/l-make-release` / `zudo-doc-version-bump`), and
`check:pin-parity` ties the scaffold's internal pins to that version. **Never** touch them
here; doing so will fail the internal-pin parity check.

## The pin map — every place a version lives (keep in lockstep)

`pnpm up @takazudo/zfb@latest` only edits the root pin and silently leaves the rest stale.
`scripts/check-pin-parity.mjs` (run by `pnpm check:pin-parity`, wired into b4push + CI) makes
that drift a hard error. The pins live in:

**zfb family** — `@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-adapter-cloudflare`:

1. Root `package.json` → `dependencies` — **exact** (all three)
2. `packages/create-zudo-doc/src/scaffold.ts` — literal pin strings emitted into the
   generated downstream `package.json` (all three; adapter is in a separate object)
3. `packages/create-zudo-doc/src/__tests__/scaffold.test.ts` — exact `.toBe("...")`
   assertions for `@takazudo/zfb` and `@takazudo/zfb-runtime`
4. `packages/zudo-doc/package.json` → `devDependencies` — **exact-equal** to root
   (`@takazudo/zfb`, `@takazudo/zfb-runtime` only; adapter is NOT here)
5. `packages/zudo-doc/package.json` → `peerDependencies` — **`^<root pin>`**
   (`@takazudo/zfb`, `@takazudo/zfb-runtime` only)

**zdtp** — `@takazudo/zdtp` (NOT covered by pin-parity, but keep it consistent):

1. Root `package.json` → `dependencies` — exact (e.g. `"0.2.3"`)
2. `packages/create-zudo-doc/src/scaffold.ts` — `deps["@takazudo/zdtp"] = "..."`
3. `packages/create-zudo-doc/src/__tests__/scaffold.test.ts` — `.toBe("...")` assertion
4. `packages/zudo-doc/package.json` → `peerDependencies` — `^<version>`

## Gotchas (read before bumping)

1. **The `next` dist-tag can be STALE — resolve with `latest`, not `next`.** A package's npm
   `next` tag has historically pointed at an _older_ prerelease than `latest`. "@next" in a
   request means "the newest", not the literal tag. Always `npm dist-tag ls` and take
   `latest`. (zfb currently keeps `next == latest`, but verify.)
2. **Exact-pin prerelease semver + peer coupling.** `^0.1.0-next.54` does NOT match `next.55`
   under pnpm — bump the whole zfb family to the _same_ `next.N`. Then check that the new
   zfb satisfies what zdtp (and the host) still expects, and vice-versa
   (`npm view @takazudo/zdtp@<v> peerDependencies`). Keep zdtp where the peers accept it
   unless a zdtp bump is explicitly requested.
3. **Single pnpm workspace, single lockfile.** Root `pnpm install` covers `.` and
   `packages/*`. There is no second lockfile to install separately. Commit `pnpm-lock.yaml`.
4. **A zfb/zdtp bump can carry more than pins.** A new version may add/rename config fields,
   change an admonitions preset, drop an export, etc. If `pnpm check` / `pnpm build` fails
   after the pin change, the fix belongs in `zfb.config.ts`, the scaffold templates, or
   `global.css` — not in reverting the pin. See the **Feature Change Checklist** in the root
   `CLAUDE.md` when a bump forces a host or scaffold change.

## Workflow

### Step 1 — Resolve target versions

```bash
for p in @takazudo/zfb @takazudo/zfb-runtime @takazudo/zfb-adapter-cloudflare @takazudo/zdtp; do
  echo "== $p ==" && npm dist-tag ls "$p" 2>&1 | grep -E 'latest|next'
done
# current pins:
grep -rn '@takazudo/z' package.json packages/zudo-doc/package.json \
  packages/create-zudo-doc/src/scaffold.ts \
  packages/create-zudo-doc/src/__tests__/scaffold.test.ts | grep -E '0\.1\.0-next|0\.2\.'
```

Take `latest` for each (gotcha 1). Confirm the zfb sibling binary for the build platform
exists at the target (it ships as a platform optionalDependency, e.g.
`@takazudo/zfb-linux-x64-gnu`), and verify peer coupling (gotcha 2). **If nothing is newer
than the current pins, report "already on latest" and stop** — the commit/release chain is
moot.

### Step 2 — Edit the pins in every location

Update all locations from the pin map above. The zfb family goes to the same `next.N`
everywhere; zdtp to its target. Remember:

- Root `dependencies`: exact for all.
- `scaffold.ts`: all three zfb pins + the zdtp pin.
- `scaffold.test.ts`: the `.toBe(...)` assertions for zfb, zfb-runtime, zdtp.
- `packages/zudo-doc/package.json`: `devDependencies` exact (zfb, zfb-runtime);
  `peerDependencies` `^` (zfb, zfb-runtime, zdtp).

### Step 3 — Install and verify

```bash
pnpm install                 # updates pnpm-lock.yaml
pnpm check:pin-parity        # cheap, authoritative — fails loudly on any stale pin
pnpm b4push                  # full suite: pin-parity, typecheck, unit + package tests
                             #   (scaffold tests), build, link check, html, preview smoke
```

`b4push` runs the create-zudo-doc package tests, so a missed `scaffold.test.ts` assertion
fails there. If a build/typecheck failure is a real upstream change (not a stale pin), fix it
at the proper layer (gotcha 4) — do not revert the bump.

### Step 4 — Hand off

This skill stops with a verified, **uncommitted** working tree. The standard chain is:

1. **`/commits push`** — commit the bump (e.g.
   `chore(deps): bump @takazudo/zfb stack to 0.1.0-next.<N>`) and push.
2. **`/l-make-release`** — because the bump changed the scaffold pins, cut a create-zudo-doc
   release so downstream `create-zudo-doc` users get the new pins. Skip when `--no-release`
   was passed or the bump did not touch `scaffold.ts`.

If the bump surfaced an upstream bug, stale dist-tag, missing export, or regression, file it
with **`/dev-upstream-report`** so it gets fixed at the source instead of worked around.
