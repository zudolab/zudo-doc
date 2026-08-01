# Contributing to zudo-doc

## First-time setup on a new machine

zfb and zdtp are consumed as published npm packages — there is no sibling-checkout build step. A plain install pulls everything, including zfb's prebuilt platform binary (shipped via a platform-specific npm optionalDependency, e.g. `@takazudo/zfb-linux-x64-gnu`):

```sh
pnpm install
```

Versions are pinned in `package.json` (`@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-adapter-cloudflare`, `@takazudo/zfb-md-wasm`, and `@takazudo/zdtp`) — that file is the single source of truth for which upstream versions this project builds against.

A plain `pnpm install` also runs both workspace packages' `prepare` builds, so
`dist/` is populated for you. See the "Workspace build prerequisite" section in
the repo-root `CLAUDE.md` for what happens on an `--ignore-scripts` install.

### Editing zfb / zdtp from source (escape hatch)

When you need to develop against a local zfb or zdtp checkout (e.g. fixing an upstream bug), use a temporary `pnpm.overrides` entry in `package.json` pointing the package at a local path, then `pnpm install`:

```jsonc
"pnpm": {
  "overrides": {
    "@takazudo/zfb": "link:../zfb/packages/zfb"
  }
}
```

Run `pnpm install` to wire the link, do your work, then remove the override and re-run `pnpm install` to restore the published version. Do not commit the override.

## Before you push

Run `pnpm b4push` (the 24-step pre-push validation suite). See `TESTING.md` for
the full testing strategy and which tiers run where.

## Conventions

Project conventions, commands, and architecture notes live in `CLAUDE.md` at the
repo root and in the directory-scoped `CLAUDE.md` files it indexes.
