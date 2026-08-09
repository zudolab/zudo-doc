# zudo-doc online — implementation design references

This directory carries the accepted UI prototypes and distilled pattern recipes for the
Zudo-doc Online epic. It is planning scratch — the confirm sub-task's session deletes
this directory before the root PR merges.

## Accepted prototype winners (user-picked, round 1)

| File | Surface | Role |
|---|---|---|
| `prototypes/a3-tabbed-workspace.html` | Page editor | **PRIMARY editor reference** — tabbed workspace, icon rail + flyout, vim statusbar |
| `prototypes/a1-three-pane-classic.html` | Page editor | Secondary — the EXPANDED rail state's page-tree panel look |
| `prototypes/b1-indent-tree-sitemap.html` | Outline | **PRIMARY outline reference** — indented tree + structure-consequence preview |
| `prototypes/b3-board.html` | Outline | Board view reference — kanban visual language |
| `_shared/DESIGN-SPEC.md` | All | The prototype-round spec: sample content, required elements, token rules |
| `_shared/tokens.css` | All | The 3-tier token set the prototypes share — port to light-dark() form per the plan |

## User feedback deltas on the winners (MUST implement)

- Editor (a3 base): the left rail gets an **expand/collapse option**; the expanded
  state shows the full page structure tree (a1's tree panel is the visual reference for
  that state). Persisted.
- Editor: **pop-out preview** into another window — see `references/popout-pattern.md`.
- Outline: **B-v1 + B-v3 dual style** — outline (b1) is the primary view, the kanban
  board (b3) is a switchable overview; the switch persists.
- Global: light/dark theme exactly like zudo-doc's mechanism (light-dark() +
  colorScheme driver + FOUC-free bootstrap).

## Pattern recipes

- `references/kanban-pattern.md` — the full board interaction recipe (dnd-kit layout,
  token bag, working-copy cross-column drag, keyboard drag, IME guards). Sub-task 8's
  primary spec companion.
- `references/popout-pattern.md` — the pop-out window recipe (second-SPA-instance
  model, named-window open, SSE-driven content, storage-event theme sync, close
  detection). Sub-task 7's primary spec companion.

## Viewing the prototypes

Open the HTML files directly in a browser — each is self-contained, with its own
light/dark toggle (bottom-right badge).
