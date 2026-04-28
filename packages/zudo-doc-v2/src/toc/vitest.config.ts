import { defineConfig } from "vitest/config";

/**
 * Scoped vitest config for the toc primitive folder. Lives inside the
 * topic folder so it never collides with the host root config or
 * sibling primitive folders. Run with:
 *
 *   pnpm vitest run -c packages/zudo-doc-v2/src/toc/vitest.config.ts
 *
 * The host root config at `vitest.config.ts` only globs `src/**` and
 * the `packages/zudo-doc-v2` package has not yet wired up its own
 * package-level vitest setup, so this scoped file is the path of
 * least disruption while the framework primitives are still being
 * scaffolded under E5.
 */
export default defineConfig({
  test: {
    root: __dirname,
    include: ["__tests__/**/*.test.ts"],
  },
});
