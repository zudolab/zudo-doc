# @takazudo/zudo-doc-online-worker

Cloudflare Worker (Hono + D1 + Better Auth) that will become the remote
backend for `packages/zudo-doc-online/`. Not published to npm — see
`CLAUDE.md` in this directory for the architecture.

## Local development

```sh
cp .dev.vars.example .dev.vars
# fill in BETTER_AUTH_SECRET, e.g.: openssl rand -base64 32

pnpm --filter zudo-doc-online-worker db:migrate
pnpm --filter zudo-doc-online-worker dev
```

`db:migrate` applies the tracked migrations in `migrations/` to the local D1
database (`wrangler d1 migrations apply zudo-doc-online-db --local`). It's
idempotent and version-tracked — safe to re-run after pulling new
migrations. `dev` then starts `wrangler dev` on port 8787.

## Better Auth schema

`src/auth-schema.ts` is **generated**, not hand-written. Regenerate it after
changing `src/auth.ts`'s Better Auth config (e.g. adding a plugin) with:

```sh
pnpm --filter zudo-doc-online-worker run auth:generate-schema
```

This runs the Better Auth CLI (`auth@1.6.26 generate`) against
`scripts/better-auth-cli-config.ts`, which instantiates the real
`createAuth` factory with dummy env values — so the generated schema always
matches the live plugin set. After regenerating, hand-update
`migrations/0001_better_auth.sql` (or add a new tracked migration) to match,
then re-run `db:migrate`.

## Production setup (operator step, not automated)

1. Create the D1 database: `wrangler d1 create zudo-doc-online-db`, then
   replace the placeholder `database_id` in `wrangler.toml` with the
   returned id.
2. Set the production secret: `wrangler secret put BETTER_AUTH_SECRET`.
3. Set the production `BETTER_AUTH_URL` var to this worker's deployed URL
   (e.g. via `wrangler secret put BETTER_AUTH_URL` or a `[vars]` entry in
   `wrangler.toml`, depending on how deploy config lands in a later
   sub-issue).
4. Apply migrations to the remote database:
   `wrangler d1 migrations apply zudo-doc-online-db --remote`.
5. `pnpm --filter zudo-doc-online-worker deploy`.
