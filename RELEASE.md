# Release Runbook

Maintainer reference for publishing packages to npm.

---

## Release channels

| Release type | Version pattern | npm dist-tag |
|---|---|---|
| Stable / `0.x` mainline | `X.Y.Z` (no suffix) | `latest` |
| Prerelease (opt-in preview) | `X.Y.Z-next.N`, `X.Y.Z-beta.N`, `X.Y.Z-rc.N` | `next` |

A clean `X.Y.Z` (no suffix) is the default install (`npm install <pkg>`).
Prerelease releases are opt-in (`npm install <pkg>@next`).

**Pre-1.0 policy (Scheme B).** While the project is `0.x`, the development
mainline ships **clean `0.MINOR.PATCH`** straight to `latest` — there is no
`-next` suffix on the mainline. `0.x` (major zero) is itself SemVer's "anything
may change" signal, so a breaking change rides a **minor** bump (`0.2` → `0.3`)
and everything else a **patch** bump. Because every mainline release is a clean,
monotonically-increasing version, npm routes it to `latest` automatically and a
tagless `npm install` always gets the newest build — no extra machinery, nothing
to get stuck. The `-next` / `next` channel stays available as an **opt-in**
escape hatch for a deliberate preview or the eventual `1.0.0-beta` run-up. Once a
real `1.0.0` ships, the normal stable-on-`latest` / preview-on-`next` split
resumes automatically.

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

**`next` is removed on stable graduation.** When a clean `X.Y.Z` publish
graduates the prerelease line, each publish workflow runs an extra step that
removes the `next` dist-tag (`npm dist-tag rm <pkg> next`). This prevents
`npm install <pkg>@next` from silently resolving to a stale prerelease. The
step is idempotent and non-fatal — if `next` does not exist (e.g. the first
stable release ever), the step logs a notice and succeeds anyway.

---

## How `latest` stays current (Scheme B)

There is **no dual-tag machinery** — by design. Under Scheme B the `0.x` mainline
ships clean `X.Y.Z` versions, and the publish workflow routes a clean version to
`--tag latest` directly (see the dist-tag table above). Because each mainline
release is the highest published version, npm keeps `latest` pointed at the newest
build with no probe, no retry loop, and nothing to self-disable.

> **History.** Earlier releases used a `0.2.0-next.N` mainline plus a "dual-tag
> self-disabling probe" that tried to advance `latest` alongside `next` during the
> prerelease cycle. The probe shut off the moment `latest` held a clean `X.Y.Z`,
> which is exactly how `latest` got stranded on the old `0.1.0`
> (zudolab/zudo-doc#1999). Scheme B removes the prerelease mainline and the probe
> entirely — the probe step has been deleted from all three `publish-*.yml`
> workflows.

### Manual remediation (rare)

If `latest` is ever stranded behind the newest version (e.g. the #1999 state
before the first clean release), the standing fix is simply to **ship a clean
version** — it routes to `latest` automatically through the normal publish path.
As a stopgap when you cannot cut a release immediately, re-point `latest` directly:

```sh
npm dist-tag add create-zudo-doc@<ver> latest
npm dist-tag add @takazudo/zudo-doc@<ver> latest
npm dist-tag add @takazudo/zudo-doc-history-server@<ver> latest
```

Replace `<ver>` with the exact version string (no leading `v`), e.g. `0.2.0`. The
helper `scripts/release-bootstrap-latest.mjs <ver>` runs all three with retries.

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

## `release-bootstrap-latest.mjs` — one-time remediation helper

`scripts/release-bootstrap-latest.mjs <version>` re-points the `latest` dist-tag
of all three packages to a given already-published version, with retries. It does
**not** publish anything — it only moves dist-tags.

Under Scheme B this is **not part of the normal release flow** (a clean release
moves `latest` on its own). Keep it for one-time remediation of a stranded
`latest` — most relevantly, to unstick the current `latest = 0.1.0`
(zudolab/zudo-doc#1999) if the fix is needed before the first clean `0.2.0` ships:

```sh
node scripts/release-bootstrap-latest.mjs 0.2.0-next.9
```

It is idempotent: re-running with the same version is a no-op. The **preferred**
fix, though, is simply to ship a clean version (e.g. `0.2.0`), which supersedes the
stranded tag through the normal publish path.

---

## One-time manual cleanup: remove stale `next` dist-tag (#2121)

As of the first stable `0.2.x` graduation, the `next` dist-tag on all three
packages is frozen at `0.2.0-next.9` — a stale prerelease from before Scheme B
was adopted. The publish workflows now automatically remove `next` on each future
stable graduation (see the dist-tag table note above), but the **currently-stale
tag must be cleared once by a maintainer**:

```sh
npm dist-tag rm @takazudo/zudo-doc next
npm dist-tag rm @takazudo/zudo-doc-history-server next
npm dist-tag rm create-zudo-doc next
```

Run these from any machine with an npm Automation token (`npm login` or
`NPM_TOKEN` set). Each command is idempotent — safe to re-run if the tag has
already been removed.
