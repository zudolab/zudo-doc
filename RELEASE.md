# Release Runbook

Maintainer reference for publishing packages to npm.

---

## Release channels

| Release type | Version pattern | npm dist-tag |
|---|---|---|
| Stable | `X.Y.Z` (no suffix) | `latest` |
| Prerelease | `X.Y.Z-next.N`, `X.Y.Z-beta.N`, `X.Y.Z-rc.N` | `next` |

Stable releases are the default install (`npm install <pkg>`).
Prerelease releases are opt-in (`npm install <pkg>@next`).

---

## dist-tag table

| Git tag pattern | Package | npm dist-tag |
|---|---|---|
| `v1.2.3` | `create-zudo-doc` | `latest` |
| `v1.2.3-next.1` | `create-zudo-doc` | `next` |
| `zudo-doc-v1.2.3` | `@takazudo/zudo-doc` | `latest` |
| `zudo-doc-v1.2.3-next.1` | `@takazudo/zudo-doc` | `next` |
| `zudo-doc-history-server-1.2.3` | `@takazudo/zudo-doc-history-server` | `latest` |
| `zudo-doc-history-server-1.2.3-next.1` | `@takazudo/zudo-doc-history-server` | `next` |

The CI publish workflow computes the dist-tag from the version string: any
version containing `-` gets `--tag next`; a clean `X.Y.Z` gets `--tag latest`.

---

## Dual-tag self-disabling policy

During a prerelease cycle the publish workflow also advances the `latest` dist-tag
alongside `next`. This **dual-tag behaviour** activates only when the registry's
current `latest` for that package is either:

- absent (package newly created), or
- itself a prerelease (contains `-`).

It **self-disables** once a real stable version (`X.Y.Z` with no suffix) holds
`latest`. After that, stable publishes update `latest` through the normal single-tag
path and prerelease publishes touch only `next`.

### Manual remediation

If the workflow's automatic dual-tag retries exhaust (e.g. a transient npm registry
error), run these commands manually:

```sh
npm dist-tag add create-zudo-doc@<ver> latest
npm dist-tag add @takazudo/zudo-doc@<ver> latest
npm dist-tag add @takazudo/zudo-doc-history-server@<ver> latest
```

Replace `<ver>` with the exact version string (no leading `v`), e.g. `0.2.0-next.1`.

---

## Dry-run auth smoke

Each publish workflow supports a `workflow_dispatch` with `dry_run: true`. In this
mode the workflow verifies that `NPM_TOKEN` authenticates against the registry via
`npm whoami`, then stops without publishing anything.

**Caveat:** the dry-run must target the *candidate* tag or ref — NOT `main` and NOT
an already-published tag. The reason is ordering: the workflow runs a "version not
already published" safeguard (Safeguard 3) *before* the dry-run/auth step
(Safeguard 4). An already-published tag triggers a hard failure at Safeguard 3 and
the auth smoke is never reached. Similarly, dispatching from `main` fails at
Safeguard 1 (tag-shape check) before auth is tested.

Correct dry-run target: a tag or branch pointing at the candidate commit whose
version has been bumped in `package.json` but not yet published to npm.

---

## Publish order

**Always publish `@takazudo/zudo-doc-history-server` and `@takazudo/zudo-doc`
before `create-zudo-doc`.**

The scaffold tool pins a specific `@takazudo/zudo-doc` version in the generated
downstream `package.json`. If `create-zudo-doc` is published first and a user runs
the scaffold before the peer packages land on npm, `pnpm install` in the new project
fails with a 404 on the pinned `@takazudo/zudo-doc` version.

Recommended sequence when all three packages change in the same release:

1. Tag `zudo-doc-history-server-X.Y.Z` and publish the GitHub Draft Release for
   `@takazudo/zudo-doc-history-server`. Wait for the CI publish to succeed.
2. Tag `zudo-doc-vX.Y.Z` and publish the Draft Release for `@takazudo/zudo-doc`.
   Wait for the CI publish to succeed.
3. Tag `vX.Y.Z` and publish the Draft Release for `create-zudo-doc`.

If only one or two packages changed, skip the unchanged packages — but still
maintain the order above for any that do change.

---

## Tag namespaces and Draft Release model

Each package has its own tag namespace and its own publish workflow. Publishing a
GitHub Draft Release fires exactly one workflow — the one whose Safeguard 1 tag
pattern matches the tag:

| Package | Tag namespace | Example tag |
|---|---|---|
| `create-zudo-doc` | `v*` | `v0.2.0-next.1` |
| `@takazudo/zudo-doc` | `zudo-doc-v*` | `zudo-doc-v0.2.0-next.1` |
| `@takazudo/zudo-doc-history-server` | `zudo-doc-history-server-*` | `zudo-doc-history-server-0.2.0-next.1` |

The `zudo-doc-v` prefix keeps `@takazudo/zudo-doc` tags distinct from the bare `v*`
namespace so a single tag dispatch always fires exactly one workflow. The anchored
regex in each workflow's Safeguard 1 rejects tags that match a sibling namespace.

Create one GitHub Draft Release per package. The draft is the human gate: reviewing
the draft and clicking "Publish release" is the irreversible action that triggers CI
to call `npm publish`. An unpublished draft fires no workflow.

---

## One-time stale-`latest` bootstrap

After publishing the very first new prerelease (e.g. `0.2.0-next.1`) via CI, the
`latest` dist-tag for all three packages may still point at the old stable version
(`0.1.0`). Until `latest` is moved to a prerelease string, the dual-tag probe in the
publish workflow sees a stable `latest` and self-disables — so subsequent prerelease
publishes never advance `latest`.

Run the bootstrap helper **once** after the first new prerelease lands on npm:

```sh
node scripts/release-bootstrap-latest.mjs <version>
```

Example:

```sh
node scripts/release-bootstrap-latest.mjs 0.2.0-next.1
```

This moves `latest` for all three packages to the given prerelease version. The
workflow's dual-tag probe then re-enables itself: from that point on, every
subsequent prerelease publish automatically advances `latest` alongside `next`, and
once a real stable version is published the policy self-heals — `latest` will hold
a stable version and the probe disables itself permanently.

The script is idempotent: re-running it with the same version is safe.
