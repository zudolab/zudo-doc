# _temp-resource/

Committed scratch resources handed from one Claude Code session to a **later** session
via git — the reliable channel when Dropbox/cclogs is unavailable (e.g. Claude Code web).

## Rule

- One subdir per topic, named `<issue-number>-<topic-slug>/`
  (e.g. `_temp-resource/4444-tweak-header/`). The number is the GitHub issue
  (the **epic** for `/big-plan`, the single issue for `/x-as-pr`).
- Put prototypes, design references, fixtures, sample data — anything a downstream
  session needs that is not already in the repo or expressible inline in the issue.
- Reference files by this in-repo path from the issue body (portable across machines + web).

## Lifecycle

- **Committed** (NOT gitignored) so it travels on the branch/PR.
- **Temporary** — delete the topic subdir when the delegated work merges, so it does not
  reach the default branch. Harmless if left behind: repo tooling excludes this dir.

See the `dev-setup-temp-resource` skill for the full handoff protocol.
