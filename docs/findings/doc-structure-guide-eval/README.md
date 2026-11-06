# Documentation-structure guide: distribution checks and a small editorial evaluation

Date: 2026-11-06. Base: `main` at `4b5b54e3e`. Scope: the Maintaining Documentation Structure
guide, the scaffold's `AUTHORING.md` policy and its `README.md` / `CLAUDE.md` / `AGENTS.md`
entry points, the `zudo-doc-writing` scaffold skill, and the `setup-doc-skill.sh` update mode.

This is a small editorial evaluation run by the change's author with AI subagents. It is **not**
a tree test with real users, and no result below should be read as one. Distribution checks and
editorial-judgment checks are reported separately.

## Distribution checks

Run with Node 24.22.1 and pnpm 10.30.3 against the freshly built `create-zudo-doc` CLI.

| Check | How | Result |
|-------|-----|--------|
| Fresh scaffold, skills off | `create-zudo-doc off-proj --yes --no-claude-skills --no-claude-skills-writing --no-skill-symlinker --no-i18n` | `AUTHORING.md`, `README.md`, `CLAUDE.md`, `AGENTS.md` present; each entry point names `` `AUTHORING.md` `` once; the category table appears only in `AUTHORING.md`; no entry point or the policy names an optional skill |
| Fresh scaffold, skills on | `--claude-skills-writing --skill-symlinker --i18n --codex-resources` | Same entry-point result; `.claude/skills/zudo-doc-writing/SKILL.md` reads `AUTHORING.md`; `AUTHORING.md` names that skill path (feature is on) |
| Offline minimal procedure | Inspect `AUTHORING.md` | Four questions, typo skip, review triggers, and option comparison are inline; the one URL is an optional pointer to the guide source |
| Claude and Codex generation | `HOME=<temp> bash scripts/setup-doc-skill.sh --target both` in the skills-on project | Exit 0. Both `.claude/skills/<name>-wisdom/SKILL.md` and `.codex/skills/<name>-wisdom/SKILL.md` contain the update-mode "Check placement" step naming the project's `AUTHORING.md`; the Lookup mode section has no audit step |
| Codex reach path | Inspect `.codex/skills/` | Only the generated wisdom skill is there; `zudo-doc-writing` stays `.claude`-only (target separation unchanged). Codex reaches the policy through `AGENTS.md` |
| Tarball | `npm pack --dry-run` in `packages/create-zudo-doc` | `dist/authoring-gen.js`, the base `setup-doc-skill.sh`, and the writing skill are included; no test files |
| Template sync | `cmp scripts/setup-doc-skill.sh packages/create-zudo-doc/templates/base/scripts/setup-doc-skill.sh`; `pnpm check:template-drift` | Identical; no drift |
| Unit contract | `packages/create-zudo-doc` vitest (includes the new `authoring-policy.test.ts` and the updated 21-file manifest) | 825 passed |

## Adoption checks (existing projects)

A Sonnet subagent received only the guide's existing-project section and two fixtures.

| Fixture | Expected | Observed (verified by diff) |
|---------|----------|------------------------------|
| `legacy`: custom `CLAUDE.md` and `README.md`, policy in a `CONTRIBUTING.md` section, no `AGENTS.md` | Reuse `CONTRIBUTING.md`, append only, keep existing instructions | Reused `CONTRIBUTING.md`; appended one section to `CLAUDE.md` and `README.md`; original lines untouched; did not create `AUTHORING.md` |
| `legacy`, second run | No duplicate section | No change; each file still references the policy once |
| `public-canon`: policy is published MDX, `CLAUDE.md` already points to its source path | Recognise it as adopted | No change; reported that the source path (not the URL) is already referenced |

Follow-up applied to the guide: the agent did not create a missing `AGENTS.md`, because the guide
did not say when to. Step 3 now says to create one containing only the reference section when the
project uses an agent that reads `AGENTS.md`.

## Editorial-judgment evaluation

Conditions: two runs of the same Claude Code subagent configuration (`general-purpose`, model
`sonnet`), each told to read only its guidance files plus the same fixed scenario file, no
filesystem search, no web. Inputs, guidance files, and outputs were kept in the session scratchpad;
they are summarised here.

- **Current guidance:** the `zudo-doc-writing` scaffold skill from `main`.
- **Revised guidance:** the revised skill plus the new guide.
- **Scenario file:** one site ("Acme Widgets docs") with `getting-started/`, `guides/`
  (end-user how-tos), `deploy/` (three hosts), `reference/` (11 homogeneous endpoint pages), and a
  120-entry dated `notes/` note tray. Owner decisions: the category definitions above, and URLs
  under `/docs/guides/` must not change. Nine scenarios, S1–S9.

Graded by the author against what a decision needed to contain (reader task, duplication,
constraints, reason for any reorganization), not against a single correct tree.

| Scenario | Current guidance | Revised guidance |
|----------|------------------|------------------|
| S1 add a fourth host page | Keep; add under `deploy/` | Keep; add with a one-line reason; checks drafts/unlisted for duplicates |
| S2 plugin-author cluster under `guides/`, two findability reports | Moves to a new top-level `plugins/` plus header item; compares three options | Starts a structure review from the reader problem; compares keep, nested, new category, index; prefers editorial re-parenting if URLs are linked externally |
| S3 12th homogeneous reference page | Keep | Keep; states count is not a reason to split |
| S4 duplicate request | Update the existing page | Update the existing page |
| S5 cross-cutting auth page | One page plus links | One primary home plus links; marks an ambiguous home as a hypothesis until confirmed |
| S6 120-entry note tray | Keep the note tray | Keep; reopen only on a concrete topic-access problem |
| S7 right category vs. fixed URL, plus locale and version snapshot | Keep file; editorial tree; leave `docs-v1` alone; asks owners | Same, and separates logical reclassification from the file move and names the chrome consumers that will not follow the sidebar |
| S8 typo | Fix only | Fix only; no review |
| S9 repeat request with no new evidence | No change | No change; same conclusion |

Reading of the results: both runs reached reasonable decisions on all nine scenarios. The scenario
file stated the owners' category definitions, which already carries most of the judgment; the
current guidance plus a capable model handled the homogeneous, duplicate, note-tray, typo, and
repeat cases. The revised guidance changed the *shape* of the reasoning rather than the outcomes:
the reader problem was written first in S2, option comparison was explicit, hypotheses were
labeled, reading scope was stated, and the logical-versus-physical distinction appeared in S7.
With one run per variant this does not show a reliable quality difference.

### Discovery from a generated project

A Sonnet subagent was opened in a generated skills-off project (plus one extra `guides/` page) with
no mention of the policy, and asked to add a Netlify deployment page and fix a typo.

- It read `CLAUDE.md`, `AGENTS.md`, `AUTHORING.md`, and `README.md`, answered the four questions,
  placed the page under `guides/` with a one-line reason, and ran no structure review.
- It did not record the routine placement in the policy.
- It flagged that `guides/` was missing from the `AUTHORING.md` category table and left it for the
  owners instead of filling it in (the table is seeded only with the generator's categories).
- The typo did not exist; it said so and changed nothing.

## Not run

- Repeated runs per variant, other models, or a Codex CLI run of the generated `AGENTS.md` path
  (the Codex path was checked by inspecting generated files only).
- Any evaluation with real readers.
- An LLM check in CI; none was added.
