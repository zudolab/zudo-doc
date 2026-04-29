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
 *   - /api/ai-chat 401/400/405 (proves SSR wiring without calling
 *     Anthropic — anything that returns the SPA-shell HTML means the
 *     CF adapter wrap or worker-runtime wiring is broken)
 *
 * Total wall-clock budget: ≤15s. Exit codes: 0 = pass, non-zero = fail.
 *
 * Env overrides:
 *   SMOKE_PORT   — port to bind preview on (default 4321).
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
const READY_TIMEOUT_MS = 10_000;
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
    status: [400, 401, 405],
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
  try {
    child.kill("SIGTERM");
  } catch {}
  // wrangler spawns workerd as a sub-process tree; SIGTERM on the
  // parent should propagate, but a stuck workerd can leave the port
  // bound. Best-effort sweep so the next b4push step does not collide.
  try {
    spawn("pkill", ["-f", "wrangler pages dev"], {
      stdio: "ignore",
    }).unref();
    spawn("pkill", ["-f", "workerd"], { stdio: "ignore" }).unref();
  } catch {}
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
      // Wrangler version pin in zfb is ahead of our installed wrangler
      // for the migration window; bypass the gate so the smoke runs.
      env: { ...process.env, ZFB_SKIP_WRANGLER_VERSION_CHECK: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

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
