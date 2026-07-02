#!/usr/bin/env node

/**
 * smoke-preview.mjs — automated preview-shape smoke test.
 *
 * Boots `pnpm preview` (which delegates to `wrangler pages dev` under
 * the Cloudflare adapter), waits for the server to come up, fetches a
 * representative set of URLs, and asserts the deploy-shape checks
 * documented in epic #500 S6:
 *
 *   - HTML routes 200 + non-empty <main>
 *   - /sitemap.xml 200 + <?xml preamble
 *   - /search-index.json 200 + valid JSON with ≥1 entry
 *   - /llms.txt 200 + non-empty body
 *   - /api/ai-chat 200/400/401/405 with JSON content-type (proves SSR
 *     wiring without depending on Anthropic — 200 is the showcase's
 *     demo-mode reply, 400/401/405 cover real-mode error shapes;
 *     anything that returns the SPA-shell HTML means the CF adapter
 *     wrap or worker-runtime wiring is broken)
 *
 * Wall-clock budget: a few seconds once bound; boot may take up to ~15s
 * under polling (see CHOKIDAR_USEPOLLING). Exit codes: 0 = pass, non-zero = fail.
 *
 * Env overrides:
 *   SMOKE_PORT          — port to bind preview on (default 4321).
 *   CHOKIDAR_USEPOLLING — force chokidar polling instead of inotify; defaults
 *     to "true" here so wrangler's watcher can't exhaust WSL's inotify-instance
 *     limit at boot. Set "false" to force native watching where it's not needed.
 *   CHOKIDAR_INTERVAL   — poll interval in ms (default 1000).
 *
 * Caller is expected to populate `dist/` first via `pnpm build` and to
 * hold the port lock at /tmp/x-wt-teams-zudo-doc2-locks/port-<n>.lock
 * when running this in an x-wt-teams worktree.
 */

import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import process from "node:process";

const PORT = Number(process.env.SMOKE_PORT ?? "4321");
const BASE = `http://127.0.0.1:${PORT}`;
// Polling (see spawn env below) makes chokidar stat the whole dist/ tree once
// at startup before the server reports ready, which is slower than an inotify
// registration — 15s absorbs that on colder/CI machines (it's a ceiling, not
// a fixed wait: waitForReady returns the instant the server binds).
const READY_TIMEOUT_MS = 15_000;
const READY_POLL_MS = 250;
const REQUEST_TIMEOUT_MS = 4_000;

/** Check definitions. `status` may be a number or array of acceptable codes. */
const checks = [
  { url: "/", status: 200, body: htmlMainNonEmpty },
  { url: "/docs/getting-started/", status: 200, body: htmlMainNonEmpty },
  {
    url: "/sitemap.xml",
    status: 200,
    body: (s) =>
      /^\s*<\?xml\b/.test(s) ? null : "expected <?xml preamble",
  },
  { url: "/search-index.json", status: 200, body: searchIndexHasEntries },
  {
    url: "/llms.txt",
    status: 200,
    body: (s) => (s.trim().length > 0 ? null : "empty body"),
  },
  {
    url: "/api/ai-chat",
    method: "POST",
    status: [200, 400, 401, 405],
    body: ssrJsonResponse,
  },
];

function htmlMainNonEmpty(html) {
  const m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (!m) return "no <main> element";
  // Strip tags and check there is some textual content. Threshold is
  // intentionally low — empty layout shells render <main></main> with
  // little or no inner text, real pages render at least a heading.
  const text = m[1].replace(/<[^>]+>/g, "").trim();
  if (text.length < 20) return `<main> body too short (${text.length} chars)`;
  return null;
}

function searchIndexHasEntries(text) {
  let j;
  try {
    j = JSON.parse(text);
  } catch (e) {
    return `JSON parse failed: ${e.message}`;
  }
  const entries = Array.isArray(j)
    ? j
    : Array.isArray(j.docs)
      ? j.docs
      : null;
  if (!entries) return "no detectable entries array";
  if (entries.length < 1) return "0 entries";
  return null;
}

function ssrJsonResponse(_body, response) {
  // The SSR endpoint returns a JSON envelope. If the response is
  // text/html, wrangler is shimming a missing _worker.js and serving
  // the SPA shell — i.e. SSR is not wired. Surface that distinctly.
  const ct = response.headers.get("content-type") || "";
  if (!/json/i.test(ct))
    return `expected JSON content-type, got "${ct}" (SSR likely not wired — missing dist/_worker.js or runtime crash)`;
  return null;
}

function cleanup(child) {
  // Kill the entire process group spawned with detached:true so that
  // wrangler and its workerd child are both terminated. Negative PID
  // targets the process group. Fall back to child.kill() if the group
  // kill fails (e.g. process already exited).
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {}
  }
}

async function waitForReady(child) {
  const start = Date.now();
  while (Date.now() - start < READY_TIMEOUT_MS) {
    if (child.exitCode != null) {
      throw new Error(
        `preview exited unexpectedly during boot (code ${child.exitCode})`,
      );
    }
    try {
      const r = await fetch(`${BASE}/`, {
        signal: AbortSignal.timeout(1000),
      });
      if (r.status === 200) return;
    } catch {
      // not ready yet
    }
    await delay(READY_POLL_MS);
  }
  throw new Error(
    `preview did not bind on port ${PORT} within ${READY_TIMEOUT_MS}ms`,
  );
}

async function runCheck(c) {
  const init = { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) };
  if (c.method) {
    init.method = c.method;
    init.headers = { "content-type": "application/json" };
    init.body = "{}";
  }
  let r;
  try {
    r = await fetch(`${BASE}${c.url}`, init);
  } catch (err) {
    return `${c.url}: fetch failed: ${err.message}`;
  }
  const expected = Array.isArray(c.status) ? c.status : [c.status];
  if (!expected.includes(r.status)) {
    return `${c.url}: status ${r.status}, expected ${expected.join(" or ")}`;
  }
  const body = await r.text();
  const err = c.body(body, r);
  return err ? `${c.url}: ${err}` : null;
}

async function main() {
  const child = spawn(
    "pnpm",
    ["exec", "zfb", "preview", "--port", String(PORT)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        // Wrangler version pin in zfb is ahead of our installed wrangler
        // for the migration window; bypass the gate so the smoke runs.
        ZFB_SKIP_WRANGLER_VERSION_CHECK: "1",
        // wrangler's chokidar watcher calls inotify_init() per watched path,
        // which on WSL (fs.inotify.max_user_instances defaults to 128)
        // exhausts the instance cap against dist/'s ~700 files: the server
        // never binds, spewing "EMFILE: too many open files, watch". Polling
        // (fs.watchFile / stat) uses zero inotify instances, sidestepping it.
        // wrangler exposes no flag to disable the watcher (--live-reload is
        // already false and doesn't govern asset watching), so this env is
        // the only lever. Forced on for determinism across platforms; a
        // caller can set CHOKIDAR_USEPOLLING=false to force native watching.
        // The smoke never edits files, so a slow poll keeps CPU near-zero.
        CHOKIDAR_USEPOLLING: process.env.CHOKIDAR_USEPOLLING ?? "true",
        CHOKIDAR_INTERVAL: process.env.CHOKIDAR_INTERVAL ?? "1000",
      },
      stdio: ["ignore", "pipe", "pipe"],
      // detached:true creates a new process group so cleanup() can kill
      // the entire tree (wrangler + workerd) via process.kill(-pid).
      detached: true,
    },
  );

  // Make sure a Ctrl-C / SIGTERM tears down the preview tree even if
  // we die mid-check — without this the wrangler/workerd subprocess
  // keeps the port bound for the next b4push step.
  const onSignal = (signal) => {
    cleanup(child);
    // Re-raise so callers see the original signal exit code.
    process.kill(process.pid, signal);
  };
  process.once("SIGINT", () => onSignal("SIGINT"));
  process.once("SIGTERM", () => onSignal("SIGTERM"));

  let stderrBuf = "";
  child.stdout.on("data", () => {});
  child.stderr.on("data", (d) => {
    stderrBuf += d.toString();
  });

  try {
    await waitForReady(child);
  } catch (err) {
    console.error(`[smoke-preview] ${err.message}`);
    if (stderrBuf) console.error(stderrBuf);
    cleanup(child);
    process.exit(1);
  }

  const results = await Promise.all(checks.map(runCheck));
  const failures = results.filter(Boolean);

  cleanup(child);

  if (failures.length === 0) {
    console.log(`[smoke-preview] ✓ ${checks.length}/${checks.length} checks passed`);
    process.exit(0);
  }

  const passed = checks.length - failures.length;
  console.error(
    `[smoke-preview] ✗ ${passed}/${checks.length} checks passed; failures:`,
  );
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

main().catch((err) => {
  console.error("[smoke-preview] fatal:", err);
  process.exit(1);
});
