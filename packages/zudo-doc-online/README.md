# zudo-doc online

A local web app for creating and authoring zudo-doc documentation bases — by a
person through the SPA, or by an AI agent through the local API server and its
MCP wrapper. Private workspace package (epic zudolab/zudo-doc#3327).

## Development

| Command                     | What it runs                                          | Port |
| ---------------------------- | ------------------------------------------------------ | ---- |
| `pnpm --filter zudo-doc-online dev`        | Vite dev server for the SPA                             | 4323 |
| `pnpm --filter zudo-doc-online dev:server` | The local file-backed API server (Hono)                 | 4324 |
| `pnpm --filter zudo-doc-online mcp`        | The MCP stdio server, wrapping the API above             | —    |
| `pnpm --filter zudo-doc-online test`       | Vitest (in-process; no ports)                           | —    |
| `pnpm --filter zudo-doc-online typecheck`  | `tsc --noEmit`                                          | —    |
| `pnpm --filter zudo-doc-online build`      | Production `vite build` of the SPA                       | —    |
| `pnpm --filter zudo-doc-online check:classes` | Class-emission audit — see `CLAUDE.md`                | —    |

The API server binds to `127.0.0.1` only — it writes real files to
`packages/zudo-doc-online/server/data/` with no authentication, so it must
never be reachable from the network.

### Install notes

This package depends on `@takazudo/zudo-doc` (`workspace:*`) for its
`./catalog` subpath only — a pure-data import (the theme-pack catalog) that
loads none of that package's `@takazudo/zfb` / `@takazudo/zdtp` / `katex` /
`diff` peer dependencies at runtime. A root `pnpm install` may report those
peers as unmet for this workspace — that's expected and safe to ignore; it's
this package declining peers it never imports, not a broken install.

## Using this as an agent (MCP)

AI agents author zudo-doc documentation bases through the API server, via the
MCP stdio server in `mcp/`. This is a primary way to use zudo-doc online, not
an afterthought — the SPA and an agent are two clients of the same REST
contract (`server/app.ts`).

### Setup

1. Start the API server (leave it running):

   ```bash
   pnpm --filter zudo-doc-online dev:server
   ```

2. Register the MCP server with your agent. For Claude Code:

   ```bash
   claude mcp add zudo-doc-online -- pnpm --filter zudo-doc-online mcp
   ```

   The MCP server talks to the API server over HTTP at
   `http://127.0.0.1:4324` by default; set `ZUDO_DOC_ONLINE_API` to point it
   elsewhere.

### Tools

| Tool                    | Purpose                                                                 |
| ------------------------ | ------------------------------------------------------------------------ |
| `list_projects`          | List every project and its current revision.                            |
| `create_project`         | Create a new project (one seeded category and page).                    |
| `get_project`            | Full snapshot: outline, page metadata, revision.                        |
| `outline_overview`       | Compact human-readable tree — the orientation call.                     |
| `apply_outline_command`  | Restructure categories/pages (add, rename, move, remove, reorder, ...). |
| `get_page`               | Read a page's frontmatter and markdown body, with lint warnings.        |
| `write_page`             | Write a page's frontmatter and/or markdown body.                        |
| `authoring_guide`        | The zudo-doc content-authoring conventions, as markdown.                |

Every mutation (`apply_outline_command`, `write_page`) takes an
`expectedRevision` and returns the new `revision`. If the project changed
underneath the call, the tool returns a structured error instead of applying
anything:

```json
{ "code": "stale-revision", "message": "...", "latestRevision": 4 }
```

Re-read (`get_project` or `outline_overview`) and retry with the new
revision — never retry with the same one.

### A worked agent flow

1. **Orient.** `list_projects` to find the target project's slug, then
   `outline_overview` to see its current structure.
2. **Restructure.** `apply_outline_command` to add/move/remove categories and
   pages. `add-page`'s response includes the new page's id.
3. **Write pages.** `authoring_guide` once per session to load the content
   conventions, then `write_page` for each page's frontmatter and body.
4. **React to warnings.** `write_page`'s response includes `warnings[]` when
   the body breaks a zudo-doc convention (a stray h1, an unknown admonition,
   `{title="..."}` instead of `[Title]`). The write still lands — fix the
   body in a follow-up `write_page` call.
5. **Re-read** with `get_project` whenever another client (the SPA, another
   agent) might have changed the project, or after a `stale-revision` error.
