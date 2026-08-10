# zudo-doc-online

Private workspace package (epic zudolab/zudo-doc#3327): a local web app for
creating and authoring zudo-doc documentation bases — by a person through a
Preact SPA, or by an AI agent through a local file-backed API server and its
MCP stdio wrapper. Not published to npm; not part of the framework
(`packages/zudo-doc/`) — see the design-system skill below for why the two
stay deliberately decoupled.

Run instructions and the MCP registration/agent-flow walkthrough live in
`README.md`. This file is the architecture map.

## Three processes, one contract

| Process | Command | Port | Role |
| --- | --- | --- | --- |
| SPA | `pnpm --filter zudo-doc-online dev` | 4323 | Vite + Preact; the human-facing editor/outline UI |
| API server | `pnpm --filter zudo-doc-online dev:server` | 4324 | Hono; the ONLY process that touches the filesystem or `node:fs` |
| MCP server | `pnpm --filter zudo-doc-online mcp` | — (stdio) | Wraps the API server's REST surface as agent tools |

4321/4322 and 4500-4504 are taken by other tooling in this repo (the host zfb
dev server, doc-history server, and e2e fixture ports) — 4323/4324 were
chosen to stay clear of all of them. The SPA and the MCP server are both
*clients* of the API server; neither has its own copy of the truth. The API
server binds `127.0.0.1` only (see `server/index.ts`'s header) — it writes
real files with no authentication, so it must never be reachable from the
network.

## SPA routes (`src/app/router.ts`, `src/app/routes.tsx`)

Multi-project routing (epic #3345). `router.ts` is a typed, dependency-free
hash router; `routes.tsx` maps each route to a lazy import of its feature's
own `route.tsx` stub — later sub-issues replace only their stub, never the
router or this map.

| Hash | Route | Feature |
| --- | --- | --- |
| `#/` (default) | `projects` | `src/features/projects/` — the D3 master-detail dashboard: rail (`listProjects({summary:true})`) + detail pane (`getProject(slug)`) |
| `#/new` | `new-project` | `src/features/new-project/` — the C3 gallery-first creation wizard (theme-pack grid + name/mode finish sheet) |
| `#/p/:slug/outline` | `outline` | `src/features/outline/` — indented tree + board (kanban) view |
| `#/p/:slug/editor/:pageId` | `editor` | `src/features/editor/` — tabbed workspace |
| `#/p/:slug/popped-out/preview/:pageId` | `popped-out-preview` | `src/features/popout/` — chrome-less preview window |

Legacy pre-multi-project hashes (`#/outline`, `#/editor/:pageId`,
`#/popped-out/preview/:pageId`, un-scoped) still parse — to the project-scoped
equivalent against `LEGACY_FALLBACK_SLUG` (`src/app/project.ts`, the seeded
project's slug). An unknown or malformed hash (including a decode failure on
a percent-encoded segment) falls back to the default `projects` route rather
than throwing, since `parseRoute` runs before the shell mounts.

## Headless core (`src/core/outline/`)

The outline domain model — `types.ts` (the `OutlineDoc` shape and the ten
`OutlineCommand` variants: add/rename/remove/move category, add-page,
set-page-slug, remove-page, move-page, reorder-pages, replace-doc),
`commands.ts` (pure reducers), `slugs.ts`, `revision.ts`, `site-map.ts`. Zero
DOM, zero Node — it runs unchanged in the browser, in the API server, and in
tests. This is what makes the SPA's in-memory test provider
(`src/store/memory-provider.ts`) and the API server's real file-backed store
agree on behavior without duplicating it.

**Contract 1 (epic-wide): title ownership.** Page titles/descriptions/draft
flags live ONLY in page frontmatter. The outline stores structure only
(`PageRef {id, slug}`). There is no `rename-page` outline command — a title
edit goes through the page-write path, never the outline-command path.

## Store contract + revision coordinator (`src/store/`)

`contract.ts` defines `ProjectStore`, the transport-agnostic interface the
SPA edits through — shapes mirror the live API field-for-field. Two
implementations: `http-provider.ts` (talks to the real server) and
`memory-provider.ts` (tests, and a future offline mode). Neither is meant to
be used directly by UI code.

`revision-coordinator.ts` wraps a provider so every mutation for one project
is serialized through a single FIFO queue and always carries the
coordinator's own freshest known revision — never a value a caller captured
earlier. This closes a same-tab race (two save machines both read
`revision: 5`, both fire) without weakening the real cross-client guard: a
genuine remote conflict still 409s and is forwarded to the caller untouched.
`save-machine.ts` is the per-page dirty/saving/saved state machine built on
top of the coordinator.

`events.ts` (client side) subscribes to the API server's SSE stream and
compares each event's `origin` against this tab's own id (`client-id.ts`) to
tell "a change I just made" from "a change another tab made" — see
**Known limitations** below for the one gap in that comparison.

### Projects-directory store (`projects-directory.ts`)

A second, separate contract (`ProjectsDirectoryStore`) for project-LIST-level
operations — `listProjects`, `getProject`, `createProject`, `deleteProject`,
`duplicateProject` — deliberately split from `contract.ts`'s per-project
`ProjectStore`: create/delete/duplicate/list have no "current revision" to
serialize a `revision-coordinator.ts` FIFO queue against. This is what powers
the dashboard's master list and the wizard's create path. Same two-provider
split as the per-project pair: `projects-http-provider.ts` (real server) and
`projects-memory-provider.ts` (tests, future offline mode). `projects-events.ts`
is the **global** SSE client (`GET /api/projects/_events`) the dashboard
subscribes to for cross-process changes — e.g. an MCP agent creating a
project in another process. Errors reuse `contract.ts`'s `StoreRequestError`
taxonomy unchanged; no new error codes.

## Server: file layout + transaction model (`server/`)

`server/store/file-store.ts` is the only other file besides `tx.ts` that
touches `node:fs` (Node APIs stay behind the store seam so the app itself —
`server/app.ts` — stays portable to a non-Node runtime later, per the
extraction plan below).

- **`locks.ts`** — `KeyedMutex`, a per-project-slug async mutex. Every
  mutation must read-decide-commit without another mutation interleaving;
  unrelated projects never wait on each other.
- **`tx.ts`** — `Transaction`, a staged multi-file commit for one project
  directory. A single logical edit routinely touches `outline.json`, a page
  file, and the revision in `project.json`; writing them one at a time risks
  a crash leaving them inconsistent. Two phases: **stage** (new bodies under
  `.tx-staging/next/`, copies of disturbed live files under
  `.tx-staging/prev/` — nothing live has moved yet) then **apply** (staged
  files renamed into place, atomically per file, with the revision-bearing
  `project.json` renamed LAST). Renaming `project.json` last is what makes a
  partial commit detectable on the next boot: `startServer()`'s `recover()`
  call compares the on-disk revision against the staging manifest and either
  rolls back (`prev/`) or finishes the cleanup.
- **`frontmatter.ts`** — page frontmatter parse/serialize.

## API + SSE contract (`server/app.ts`, `server/routes/`)

This is a product contract, not an internal detail — the MCP server and the
SPA store both speak it, and it's designed for AI agents to author through
directly. Shared conventions (from `app.ts`'s own header):

- Errors are always `{error: {code, message}}` with a stable `code`.
- **409 means exactly one thing**: `expectedRevision` was stale. The body
  carries the full current `snapshot` so the loser can rebase without a
  second round trip. Nothing else returns 409 — a rejected-but-current
  request (duplicate slug, etc.) is 422; malformed is 400; missing is 404.
- Mutations accept an optional `clientId`, echoed as `origin` on the SSE
  event they cause, so the author of a change can recognize and skip its own
  event.
- CORS is handled explicitly (`Origin` restricted to loopback via
  `LOCAL_ORIGIN`, preflight answered inline) because the SPA is served from a
  different port than the API.

Routes: `GET/POST /api/projects`, `DELETE /api/projects/:slug`,
`POST /api/projects/:slug/duplicate`, `GET /api/projects/:slug`,
`POST /api/projects/:slug/outline/commands`,
`GET/PUT /api/projects/:slug/pages/:id`,
`GET /api/projects/:slug/events` (SSE, per-project),
`GET /api/projects/_events` (SSE, global — every project created, deleted, or
duplicated; registered before the `GET /:project` param route since `_events`
can never be a valid slug, but ordering still matters). `events.ts` (server
side) is the change-event fan-out `EventBus` behind both SSE routes — events
publish only AFTER a commit is durable, so a subscriber that refetches on the
event always sees at least the state the event announced. `DELETE` never
hard-deletes: the store renames the project directory into
`data/.trash/<slug>-<timestamp>` (`PROJECT_TRASH_DIR` in `file-store.ts`) —
distinct from the per-page `trash/` sibling a project directory already has
for removed pages.

## MCP tools (`mcp/`)

`index.ts` is boot-only wiring (builds a `ZudoDocOnlineClient`, registers
`createTools(client)`'s definitions on an `McpServer`, connects stdio).
`tools.ts` holds every tool as a plain async handler independent of
`McpServer`, so tests call handlers directly without standing up a
transport. `client.ts` is the only file that knows the API's URLs and wire
shapes; every failure becomes a structured `ApiError`.

Registered tools (confirmed live via a stdio smoke test — see below):
`list_projects`, `create_project`, `duplicate_project`, `delete_project`,
`get_project`, `outline_overview`, `apply_outline_command`, `get_page`,
`write_page`, `authoring_guide`. Every outline/page mutation tool takes
`expectedRevision` and returns the new `revision`; a stale one comes back as
a structured `stale-revision` error, never an auto-retry. `delete_project` is
the one tool with its own confirmation gate: it REQUIRES `confirm: true` —
omitting it (or passing `false`) is a no-op that returns a `confirm-required`
error instead of deleting anything. `authoring_guide` returns
`authoring-guide.ts`'s static markdown — the zudo-doc content-authoring
conventions (frontmatter contract, h2-not-h1 rule, the seven admonition
directives, slug rules), modeled on how a real zudo-doc project's own
CLAUDE.md teaches the same rules to Claude.

**MCP stdio smoke-tested for #3353**: booted the API server on a temp data
dir + ephemeral port, connected an `@modelcontextprotocol/sdk` stdio client
from within this package, and ran `list_projects` (summary) →
`create_project` (with a preset) → `duplicate_project` (verified the
"`<Title> copy`" title) → `delete_project` (confirmed the reject-without-
`confirm:true` / succeed-with-`confirm:true` round trip, and that the
project disappeared from a follow-up `list_projects`) — then closed the
client, closed the server, and removed the temp dir. Clean exit, no orphan
process, no residue.

**MCP stdio smoke-tested for #3340**: booted the API server on a temp data
dir, connected an `@modelcontextprotocol/sdk` stdio client from within this
package (module resolution for the SDK requires running from inside
`packages/zudo-doc-online/`, not a script located elsewhere in the repo),
called `list_projects` (returned the seeded `aurora-docs` project) and
`authoring_guide` (returned the full guide text), then closed the client and
terminated the server — clean exit, no orphan process left listening on
4324.

## Separated design system

This app's design system is a deliberately separate token set from
`@takazudo/zudo-doc`'s (`--zdo-*`, never `--zd-*`; own `tokens.css`; no
import of any `@takazudo/zudo-doc` CSS) so a later extraction of this web
service to its own repo never has to drag the framework along or de-couple
painfully after the fact. Full rules — the 3-tier token architecture,
hsp/vsp spacing axes, light/dark mechanism, CodeMirror theming, token-lint
compliance, and field findings from implementation — live in
`.claude/skills/l-design-system-zudo-doc-generator/SKILL.md`. Read it before
touching any CSS, Tailwind class, or component markup here.

Preview typography and syntax-highlight coloring are two separate
self-contained stylesheets, both scoped to this app's own tokens and neither
importing the framework's: `src/features/preview/prose.css` (`.zdo-prose` —
every element `renderHtml`'s fixed pipeline can emit) and
`src/features/preview/syntax.css` (`@layer zfb-hi` — the 18 `HighlightRole`
classes `renderHtml`'s `codeHighlight: { mode: "class" }` output needs colors
for, since the wasm ships no stylesheet of its own).

## Class-emission audit (`scripts/check-tailwind-candidates.mjs`)

A manual, package-level check — `pnpm --filter zudo-doc-online check:classes`
— NOT wired into root b4push (b4push/CI parity has its own registration
dance; wiring it there is a possible follow-up, not done here). It statically
harvests every class token reachable from a `.tsx` `className` (including
through local `const NAME = "..."` class-list constants, an indexed lookup
into a local `Record<K, string>` class map — every value in the map counts,
since the key is dynamic — and ternary branches — but never a ternary's
*condition*), runs the real `vite build`, and fails if any harvested token
produces no rule in the built CSS (a complete-selector match, so a typo like
`bg` can never pass merely because a longer class like `.bg-bg` happens to
exist). This
catches what `pnpm lint:tokens` cannot: that check only bans raw
non-token Tailwind utilities, it never verifies a class actually compiles to
something. Run it after any `className` change; a stale or typo'd utility
otherwise renders silently unstyled.

## Prototype-reference mapping

The epic's accepted UI prototypes lived in
`_temp-resource/3327-zudo-doc-online/` during implementation (deleted by this
confirm sub-issue per the epic's cleanup rule — planning scratch does not
outlive the epic). For history: `a3-tabbed-workspace.html` was the primary
editor reference (tabbed workspace, icon rail + flyout, vim statusbar),
`a1-three-pane-classic.html` was the secondary reference for the rail's
expanded-state page-tree panel, `b1-indent-tree-sitemap.html` was the primary
outline reference (indented tree + structure-consequence preview), and
`b3-board.html` was the kanban visual-language reference for the board view.
Two pattern-recipe docs (`kanban-pattern.md`, `popout-pattern.md`) covered
the board's drag/token-bag design and the pop-out window's
second-SPA-instance model respectively — both are now implemented as
described in `src/features/outline/board/` and `src/features/popout/`.

The multi-project routing epic (#3345) added its own prototype pair, also
now deleted along with `_temp-resource/3345-online-wizard-dashboard/` per
the same cleanup rule: `c3-gallery-first.html` was the reference for the
`#/new` creation wizard (full-width theme-pack gallery + slim finish sheet,
implemented in `src/features/new-project/`), and `d3-master-detail.html` was
the reference for the `#/` projects dashboard (rail + detail pane,
implemented in `src/features/projects/`).

## Known limitations

- **Duplicate-tab `clientId` collision — fixed via Web Locks, except where
  the API is missing.** `src/store/client-id.ts` still stores the per-tab id
  in `sessionStorage`, which a browser's "duplicate tab" action copies
  verbatim. Since #3360, `initClientId()` (awaited in `src/main.tsx` before
  the pop-out import and `render()`, so it settles before any surface builds
  an SSE client) claims a Web Lock named `zdo-client-id:{id}` and holds it
  for the tab's lifetime; a duplicate loses the claim, mints a fresh id,
  persists it, and re-claims — looping, since two duplicates can race. The
  residual gap: an environment without `navigator.locks` (jsdom, older
  engines) degrades to the old synchronous read, where two duplicated tabs
  share one id until one is closed and reopened and a mutation from either is
  misclassified as the other's own SSE event. The claim never rejects and
  never blocks boot — a failed claim falls back rather than leaving a blank
  SPA. Note `navigator.locks.request()`'s promise resolves only when its
  callback settles, so holding a lock for the tab's lifetime means that
  promise never resolves: the module resolves a separate handshake promise
  from inside the callback and deliberately leaves the outer one unawaited.
- **Preview sanitizer is DOMPurify with a narrowed policy.** Since #3359,
  `src/features/preview/render-runtime.ts`'s `sanitizePreviewHtml` runs
  DOMPurify — a battle-tested library — instead of the hand-rolled DOM walk
  that preceded it (epic #3327's no-new-dependency contract was lifted for
  this epic). Sanitizing at all is necessary because `renderHtml` preserves
  raw HTML from markdown verbatim (`<script>`, `onerror`, `javascript:` URLs
  all survive) and this surface is designed for AI-agent authoring, so the
  markdown's author isn't always a human. Two deliberate deviations from
  stock DOMPurify: its `ALLOWED_ATTR` is global-only, so the config passes
  the union of every tag's attributes and an `uponSanitizeAttribute` hook
  narrows it back down per tag (plus an `href`/`src` scheme check); and
  `SANITIZE_DOM` is off, matching the prior sanitizer's behavior rather than
  dropping `id`/`name` attributes the preview legitimately emits. When
  DOMPurify reports its host environment unsupported (no DOM), sanitization
  is a no-op — that path is server/test-side, never the browser preview.

## Directory map

```
mcp/                    # MCP stdio server: index.ts (boot), tools.ts (handlers),
                         # client.ts (REST wrapper), authoring-guide.ts (static guide text)
server/
├── app.ts               # Hono app: CORS, body limit, route mount, error mapping
├── events.ts             # SSE fan-out EventBus
├── index.ts              # Boot entry: recover() -> seedIfEmpty() -> serve()
├── authoring-lint.ts      # write_page-time warnings (h1-in-body, unknown admonition, ...)
├── routes/                # projects.ts, outline.ts, pages.ts
└── store/
    ├── file-store.ts       # ProjectStore implementation: the only fs entry point besides tx.ts
    ├── tx.ts                # Staged multi-file commit (stage -> apply, project.json renamed last)
    ├── locks.ts              # KeyedMutex, per-project-slug
    └── frontmatter.ts         # Page frontmatter parse/serialize
src/
├── core/outline/          # Headless domain model (types, commands, slugs, revision, site-map)
├── store/                 # ProjectStore contract, http/memory providers, revision coordinator,
│                          # save machine, client-id, SSE client events, PLUS the project-list-level
│                          # pair: projects-directory.ts (contract), projects-http/memory-provider.ts,
│                          # projects-events.ts (global SSE client)
├── theme/                 # Light/dark color-scheme sync (own storage key, no --zd-* coupling)
├── app/                   # Shell (top bar) + typed hash router (router.ts, routes.tsx)
├── features/
│   ├── projects/            # `#/` dashboard: rail + detail pane (route.tsx, rail.tsx, detail-pane.tsx,
│   │                        # dashboard-logic.ts, pack-swatch.tsx)
│   ├── new-project/          # `#/new` creation wizard: theme-pack gallery + finish sheet (route.tsx,
│   │                        # pack-preview.tsx)
│   ├── editor/              # Tabbed workspace chrome, rail, CodeMirror pane, metadata row
│   ├── outline/              # Indented tree + board (kanban) view, consequence preview
│   ├── preview/               # zfb-md-wasm render runtime, prose.css, syntax.css, sanitizer
│   └── popout/                 # Pop-out preview window (BroadcastChannel bus, registry, theme sync)
├── sample/                 # Seed content for the API server's first-run project
└── styles/                 # tokens.css (3-tier --zdo-* tokens), global.css (Tailwind entry)
scripts/
└── check-tailwind-candidates.mjs   # Class-emission audit — see above
```
