# Isolated published-package pending activation reproduction

Manager browser verification reproduces: **2 passes / 1 failure (3.5s)**; shared guard FAIL (5s). Install succeeded using actual registry
packages: zfb/runtime 4.2.1, Playwright 1.58.2, TypeScript 5.9.3. There are no
workspace links, source aliases, dependency patches, or zudo-doc imports/deps.
The standalone consumer owns its src/pages; all dependencies come from its lockfile.
Project and browser spec typechecks pass. The first offline attempt lacked
metadata; the normal registry install reused seven packages and downloaded one.

Reproduce by copying this directory into /tmp/zudo421-pending-native and
restoring native-pending.spec.ts.txt to native-pending.spec.ts. Install with
pnpm install --ignore-scripts, preserving the exact lockfile. Browser Chromium
is /usr/bin/chromium in the manager environment. The prepared run.sh uses the
manager's existing /tmp/zudo-subreaper.py for process cleanup. Elsewhere, run
pnpm exec playwright test --config playwright.config.mjs after setting your
Chromium executable path in the config; no runtime code changes are required.

The manager alone runs in the shared heavy lane:

```sh
bash "$HOME/.codex/scripts/heavy-guard.sh" -- /tmp/zudo421-pending-native/run.sh
```

Three strict cases cover direct-load visibility, nonpersisted changed-props
navigation before first activation, and persisted changed-props navigation.
All cases attach marker attrs/geometry/lifecycle before acceptance assertions.
The persisted case retains expected zero activations before explicit scroll;
the isolated registry consumer also records one activation below the viewport.
Direct-load and fresh nonpersisted changed-props controls pass. Both probe ports
44293/44294 were free after the manager runs. See run.log and report.json. Do not describe a failing expected-zero case as a passing gate.
