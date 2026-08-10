// Two invariants that only fail at runtime, in confusing ways, if they drift:
//
// 1. Better Auth's `trustedOrigins` must set-EQUAL the CORS allowlist. Drift in
//    either direction reproduces as a CSRF rejection on a caller the CORS layer
//    happily allowed (or vice versa) — a mismatch nobody reads as "config drift".
// 2. No module-scope Better Auth instance may exist. D1 bindings are
//    request-scoped in Cloudflare Workers, so an instance built at module load
//    captures a stale or undefined binding; `createAuth` must be called only
//    inside a handler or middleware.
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createAuth } from "../auth";
import { CORS_CONFIG } from "../cors";

describe("trustedOrigins / CORS allowlist lockstep", () => {
  it("set-equals the CORS allowlist in both directions", () => {
    const auth = createAuth({
      DB: env.DB,
      BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
      BETTER_AUTH_URL: "http://localhost:8787",
    });

    const trusted = auth.options.trustedOrigins;
    expect(Array.isArray(trusted)).toBe(true);

    expect([...new Set(trusted as string[])].sort()).toEqual(
      [...new Set(CORS_CONFIG.origin)].sort(),
    );
  });
});

// Raw source of every module under src/, read through Vite's glob import so the
// guard runs inside the workers runtime where `node:fs` is unavailable. `vite`
// is not a direct dependency here, so `vite/client`'s ImportMeta augmentation
// isn't resolvable — declare just the one signature this file needs.
type GlobImportMeta = ImportMeta & {
  glob: (
    pattern: string,
    options: { query: string; import: string; eager: true },
  ) => Record<string, string>;
};

const SOURCES = (import.meta as GlobImportMeta).glob("../**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});

// The hazard is an auth instance *retained* at module scope — i.e. a top-level
// binding (column 0) initialised directly from the factory, or a bare top-level
// call. A factory call nested inside a top-level expression, such as the
// `app.on(..., (c) => createAuth(c.env)...)` mount in index.ts, is per-request
// and therefore fine.
const MODULE_SCOPE_BINDING =
  /^(export\s+)?(const|let|var)\s+\w+\s*(:[^=]+)?=\s*(await\s+)?(betterAuth|createAuth)\s*\(/;
const MODULE_SCOPE_BARE_CALL = /^(await\s+)?(betterAuth|createAuth)\s*\(/;

function findModuleScopeAuthCalls(source: string): string[] {
  return source
    .split("\n")
    .filter((line) => MODULE_SCOPE_BINDING.test(line) || MODULE_SCOPE_BARE_CALL.test(line));
}

describe("request-scoped auth guard", () => {
  // Glob keys are relative to THIS file's directory, so "./…" is the test
  // directory itself and "../…" is the worker source under src/.
  const modules = Object.entries(SOURCES).filter(([path]) => path.startsWith("../"));

  it("finds the worker source modules to scan", () => {
    expect(modules.length).toBeGreaterThan(0);
    expect(modules.map(([path]) => path)).toContain("../index.ts");
  });

  it("detects a module-scope instantiation when one exists", () => {
    expect(findModuleScopeAuthCalls("const auth = createAuth(env);")).toHaveLength(1);
    expect(findModuleScopeAuthCalls("export const auth = betterAuth({});")).toHaveLength(1);
    expect(findModuleScopeAuthCalls("const auth: Auth = await createAuth(env);")).toHaveLength(1);
    // Indented (inside a function body) and nested-in-expression forms are fine.
    expect(findModuleScopeAuthCalls("  const auth = createAuth(c.env);")).toHaveLength(0);
    expect(findModuleScopeAuthCalls("app.get('/x', (c) => createAuth(c.env));")).toHaveLength(0);
  });

  it("never calls betterAuth() or createAuth() at module scope", () => {
    const offenders = modules.flatMap(([path, source]) =>
      findModuleScopeAuthCalls(source).map((line) => `${path}: ${line}`),
    );

    expect(offenders).toEqual([]);
  });
});
