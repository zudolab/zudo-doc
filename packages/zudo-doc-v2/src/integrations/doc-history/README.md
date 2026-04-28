# `@zudo-doc/zudo-doc-v2/integrations/doc-history`

Forward-port of the legacy Astro integration at
`src/integrations/doc-history.ts` onto the zfb config form. Two halves
that the host wires into `zfb.config.ts`:

- **Dev proxy** — forwards `/doc-history/*` HTTP requests to the
  standalone `@zudo-doc/doc-history-server` running on port `4322`.
- **Post-build hook** — spawns the `doc-history-generate` CLI from
  `@zudo-doc/doc-history-server` to emit per-page JSON files under
  `<outDir>/doc-history/`. Skipped entirely when `SKIP_DOC_HISTORY=1`
  (CI uses the dedicated `build-history` job for that artifact).

## Why a README and not direct `zfb.config.ts` edits

This worktree's branch base predates the topic-schema worktree where
`zfb.config.ts` is being created in parallel. Editing a not-yet-existing
`zfb.config.ts` here would conflict at merge time, so the registration
snippet lives here for the manager to apply when the topics merge.

The snippet is purely additive — a new import line and a new entry in
the existing `plugins` array. Do not reorder existing entries when
applying it.

## Registration in `zfb.config.ts`

Once `zfb.config.ts` exists (created by the topic-schema worktree),
add:

```ts
// zfb.config.ts
import { defineConfig } from "zfb/config";
import { docHistoryPlugin } from "@zudo-doc/zudo-doc-v2/integrations/doc-history";
import { settings } from "./src/config/settings";

export default defineConfig({
  // ...existing keys (outDir, framework, collections, tailwind, ...)
  plugins: [
    // ...existing plugin entries
    docHistoryPlugin({
      docsDir: settings.docsDir,
      locales: settings.locales,
      // serverPort: 4322,  // optional, defaults to 4322
      // maxEntries: 50,    // optional, defaults to 50
    }),
  ],
});
```

The descriptor returned by `docHistoryPlugin(...)` is a plain
`{ name: "doc-history", options }` value matching the v0 zfb
`PluginConfig` shape. It is JSON-serialisable so it survives the
config loader's TS-to-JSON round-trip.

## Wiring the runtime hooks

zfb's plugin runtime API for dev middleware and post-build hooks is
still TBD in v0 (the `plugins` field is documented as
"schema TBD; not yet consumed in v0"). Until that lands, the host
wires the runtime helpers exported from this module directly:

### Dev mode — Vite middleware

```ts
import { createDocHistoryDevMiddleware } from "@zudo-doc/zudo-doc-v2/integrations/doc-history";

// Inside the Vite plugin used by the zfb dev server (or the legacy
// Astro integration during the migration window):
{
  name: "doc-history-dev-proxy",
  configureServer(server) {
    server.middlewares.use(
      createDocHistoryDevMiddleware(
        {
          docsDir: settings.docsDir,
          locales: settings.locales,
        },
        // optional logger; falls back to a no-op when omitted
        { warn: (msg) => console.warn(msg) },
      ),
    );
  },
}
```

The middleware fast-paths URLs that do not contain `/doc-history/`,
so it is safe to mount unconditionally.

### Post-build — generation hook

```ts
import { runDocHistoryPostBuild } from "@zudo-doc/zudo-doc-v2/integrations/doc-history";

// Called from the host's post-build phase (the future zfb post-build
// hook, or the existing `astro:build:done` during the migration):
await runDocHistoryPostBuild(
  {
    docsDir: settings.docsDir,
    locales: settings.locales,
  },
  {
    outDir, // absolute path to the build output dir
    logger: { info: console.log, warn: console.warn },
  },
);
```

The function returns early without spawning anything when
`SKIP_DOC_HISTORY=1` is set. Otherwise it spawns
`doc-history-generate` via the platform shell so the
`node_modules/.bin` symlink resolves naturally.

## Behaviour parity

The runtime helpers preserve the legacy Astro integration's
externally-visible behaviour 1:1:

- proxy URL match rule (`includes("/doc-history/")`),
- proxy path slicing from `/doc-history/` onward (so site-base
  prefixes pass through),
- 502 fallback envelope shape on upstream failure,
- `SKIP_DOC_HISTORY=1` short-circuit with the same log message,
- `<outDir>/doc-history/<slug>.json` output layout (slugs prefixed
  with `<localeKey>/` for non-default locales).

The only deliberate change is **how** the post-build generation
runs: the legacy integration called the in-process helpers from
`src/utils/doc-history.ts`; this port spawns the
`doc-history-generate` CLI shipped by `@zudo-doc/doc-history-server`
so the inline path uses the same code as CI's separate
`build-history` job.
