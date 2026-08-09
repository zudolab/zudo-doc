# Kanban board interaction recipe (distilled from a battle-tested internal reference)

Pattern reference for the zudo-doc-online board view. The source is a mature production
kanban (React + dnd-kit + Tailwind v4); everything here is the distilled, reusable
pattern. The algorithm parts port to Preact unchanged; use dnd-kit on preact/compat.

## 1. Layout structure

Board shell — 4 nested boxes, each with an explicit `min-h-0`:

```
root            flex flex-col h-full min-h-0     ← carries the CSS-var bag as inline style
  toolbar
  dnd wrapper   relative flex min-h-0 flex-1 overflow-hidden
    scrollport  flex flex-1 min-h-0 items-stretch gap-* overflow-x-auto overflow-y-hidden p-*
```

Two decisions worth copying verbatim:

- The scrollport is `overflow-x-auto overflow-y-hidden` — vertical scrolling belongs to
  each COLUMN body, never the board.
- `items-stretch` on the scrollport + `self-stretch` on each column makes every column
  full-height without any `height: 100%` chain.

Column sizing: fixed width from a CSS var (`--kb-column-width`), applied as BOTH `width`
and `minWidth`. Keep the derivation ONE flat `calc()` (no nested calc, no `2 * var(...)`
forms — engines disagree, WebKit especially).

Column internals:

```
column root   flex min-h-0 flex-col self-stretch border
  header      flex items-center justify-between px-* py-* border-b
              + cursor-grab active:cursor-grabbing   ← header IS the column drag handle
  body        flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain p-*
              ← BOTH the scroll container AND the column droppable
    [sortable card list]
    [add-card composer]
    spacer    min-h-* flex-1   aria-hidden
```

The trailing `flex-1` spacer is the empty-column answer: no min-height hacks, no
empty-state art — the spacer swells so the whole area below the last card is inside the
droppable rect.

## 2. Token layering

Component token bag owned by the board module (adapt names to `--zdo-kb-*`):

| var | role | default |
|---|---|---|
| `--zdo-kb-board-bg` | board root | `transparent` |
| `--zdo-kb-column-bg`, `--zdo-kb-column-radius` | column | surface-2 / radius-m |
| `--zdo-kb-card-bg`, `--zdo-kb-card-border`, `--zdo-kb-card-radius` | card | surface / border / radius-s |
| `--zdo-kb-card-shadow` | card hover ONLY | shadow-1 |

Three rules that make it robust:

1. Every consumption site re-embeds the default as the `var()` fallback:
   `backgroundColor: "var(--zdo-kb-card-bg, var(--zdo-surface))"` — a surface that
   forgets to declare the scope still renders correctly.
2. The whole bag is materialized as an inline style object on the board root **and
   handed explicitly to the portaled drag overlay** — custom properties do NOT cascade
   sideways into `document.body` portals; the overlay silently falls back to global
   values otherwise.
3. Drag-state colors (ghost accent border, dialog shadow) are deliberately NOT part of
   the bag — they signal state, not chrome, and come from global semantic tokens.

Representative class lists:

```
card:    group/card relative rounded border bg-surface p-* transition-shadow
         hover:shadow-[var(--zdo-kb-card-shadow,var(--shadow-1))]
         [+ ring-2 ring-accent ring-offset-1 ring-offset-bg when keyboard-focused]
ghost:   rounded border border-accent bg-surface p-* shadow-2 opacity-90 rotate-[2.5deg]
col hdr: flex items-center justify-between px-* py-* border-b cursor-grab active:cursor-grabbing
```

## 3. Drag & drop (dnd-kit: core + sortable + utilities)

Sensors, in order:

```js
PointerSensor   activationConstraint: { distance: 8 }   // restrict to pointerType mouse|pen
TouchSensor     activationConstraint: { delay: 250, tolerance: 5 }
KeyboardSensor  coordinateGetter: customColumnAwareGetter   // see §5
```

Touch is deliberately EXCLUDED from the pointer sensor so it falls through to the
long-press touch sensor — otherwise a horizontal swipe scroll starts a drag.
Multi-touch never activates.

Activation gating shared by both pointer paths:

```js
if (el.closest("[data-dnd-activator]")) return true;   // explicit handle wins
return !el.closest("button, input, textarea, select, a, img, [data-no-dnd]");
```

Collision detection: `pointerWithin` → `rectIntersection` → `closestCorners`, over
droppables pre-filtered by active type (column drag sees only column droppables; card
drag only card/body droppables). The cascade matters for keyboard: with no pointer,
`pointerWithin` returns `[]` and only an overlap test can reach a tall EMPTY column
(distance strategies rank the card's own origin slot closer).

Id namespaces: card = raw id + `data:{type:'card', categoryId}`; column body droppable =
`column:<id>`; column sortable = `column-sort:<id>` + `data:{type:'column'}`.

Drop-target rendering: there is NO indicator line, NO placeholder element, NO ghost
slot. The gap is produced entirely by the sortable strategy translating siblings; the
source card stays in place at `opacity: 0.5`; a portaled overlay ghost follows the
pointer (`opacity-90 rotate-[2.5deg]`, column ghost `rotate-[1.5deg]` with a mini
preview: first 3 cards + "+N more").

Global cursor: toggle a body class on drag start/end with
`body.X, body.X * { cursor: grabbing !important }` + an unmount effect clearing it
unconditionally.

Auto-scroll near edges: dnd-kit's built-in default — do not disable; if ever
hand-rolling, this is the piece you must add yourself.

Click suppression after drop: a ref set true while dragging, cleared on the NEXT
macrotask (`setTimeout(…, 0)`), checked at the top of card `onClick`. Clearing on a
timer (not on drop) keeps an Escape-cancelled drag from swallowing the next genuine
click.

## 4. Cross-column move semantics (the load-bearing part)

**The relocation trick.** A sortable strategy can only open a gap inside the context
that CONTAINS the active item, and a card's column membership isn't committed until
drop — so without intervention the gap stays stuck in the source column. On every
`dragover`, maintain a drag-time WORKING COPY of the `Map<columnId, Card[]>` and move
the active card into the hovered column inside it. Render from
`workingCopy ?? derivedMap`.

```
relocateActiveCardToColumn(map, activeId, targetColumnId, overCardId)
  → returns a NEW map, or null when nothing should change
  → same-column hover → null (leave within-column gaps to the strategy)
  → overCardId null → append; else insert BEFORE that card
```

Guards on `dragover`, each earned in production:

- skip for KEYBOARD-activated drags — relocating the active node remounts it in another
  context and breaks the keyboard sensor's tracking (keyboard users get the move at drop);
- skip when `over.id === active.id` — the relocated placeholder still reports the
  ORIGINAL category (card data isn't mutated during drag); acting on it oscillates;
- when nothing changed, return the previous state reference (skip re-render).

**Commit from the working copy, not from `over`.** At release the pointer usually sits
on the relocated placeholder, whose category data is stale — trusting it drops the card
back where it started (the classic "cross-list drop didn't commit" bug). Slot
precedence at drop: (1) the final `over` if it's a real OTHER card in the final column;
(2) else the working copy's next neighbour; (3) else append.

**One mutation per drop.** Translate the drop into a single
`move-page {pageId, toCategoryId, toIndex}` command — never move() then reorder()
(avoids the intermediate state). Same-column drops emit only when the resulting
neighbour actually changed.

`onDragCancel` mirrors `onDragEnd`'s cleanup EXACTLY (clear active item, working copy,
body cursor class) — Escape, window blur, and pointer-leaves-viewport all route here;
skipping it strands the ghost.

## 5. Keyboard & a11y

- Focusable `sr-only` drag handle per card, visible on `focus-visible` as a positioned
  pill (`ring-2 ring-accent`), `aria-label="Drag to reorder"`. Space lift → arrows →
  Space drop.
- Custom coordinate getter: make ←/→ SEMANTIC COLUMN JUMPS — collect the `column:*`
  droppable rects, sort by `rect.left`, return the adjacent one's top-left; ↑/↓ fall
  through to the sortable getter. Without this the default nearest-droppable ranking
  can make the first ←/→ silently do nothing.
- Split dnd `attributes` (card root) from `listeners` (the handle), and strip
  `onKeyDown` from any listeners spread onto elements containing inline inputs — the
  exact a11y bug the reference fixed.
- Decorative grab affordances `aria-hidden`; every icon button labeled.

## 6. Composers, IME, entry animation

- Add-card composer: inline below the list; Enter submits, Shift+Enter newlines,
  STAYS OPEN after submit for rapid entry; board-wide exclusivity via a single nullable
  `openComposerKey` scalar that the setter replaces (never a Set — it accumulates).
- IME triple guard on EVERY inline input (rename, composers), because engines disagree
  on event ordering:

  ```js
  const composing = ownFlag.current || e.isComposing || e.keyCode === 229;
  if (composing) return;  // never commit/cancel on a composition Enter/Escape
  ```

- New-card entry animation: opacity + translateY(8px), 0.3s, ~50ms stagger.
