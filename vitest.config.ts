import { defineConfig } from "vitest/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = __dirname;

/** Resolve public package subpaths to their source counterparts during the red window. */
export function zfb3SourceAliases() {
  if (process.env.ZFB3_SOURCE_RESOLVE !== "1") return [];
  const packageRoot = resolve(repoRoot, "packages/zudo-doc");
  const manifest = JSON.parse(
    readFileSync(resolve(packageRoot, "package.json"), "utf8"),
  ) as { exports: Record<string, { default?: string } | string> };
  return Object.entries(manifest.exports).flatMap(([key, entry]) => {
    const target = typeof entry === "string" ? entry : entry.default;
    if (!target?.startsWith("./dist/")) return [];
    const relativeTarget = target.slice("./dist/".length);
    const isCode = relativeTarget.endsWith(".js");
    const stem = isCode ? relativeTarget.slice(0, -3) : relativeTarget;
    const source = isCode
      ? [".ts", ".tsx", ".js", ".jsx"]
          .map((extension) => resolve(packageRoot, "src", stem + extension))
          .find(existsSync) ?? resolve(packageRoot, "src", stem + ".ts")
      : resolve(packageRoot, "src", stem);
    const specifier = `@takazudo/zudo-doc${key === "." ? "" : key.slice(1)}`;
    if (specifier.endsWith("/*")) {
      const prefix = specifier.slice(0, -1);
      return [{ find: prefix, replacement: source.slice(0, -1) }];
    }
    return [{ find: new RegExp(`^${specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), replacement: source }];
  });
}

export default defineConfig({
  esbuild: { jsx: "automatic", jsxImportSource: "@takazudo/zfb/zudo-react" },
  resolve: {
    alias: [{ find: "@/", replacement: resolve(__dirname, "src") + "/" }, ...zfb3SourceAliases()],
  },
  test: {
    exclude: ["**/node_modules/**", "**/*.slow.test.ts"],
    projects: [
      { extends: true, test: { name: "unit", include: ["src/**/__tests__/**/*.test.ts"] } },
      {
        extends: true,
        test: {
          name: "scripts",
          include: ["scripts/__tests__/**/*.test.ts", "scripts/__tests__/**/*.test.mjs"],
          exclude: ["scripts/__tests__/**/*.slow.test.ts"],
          testTimeout: 60_000,
        },
      },
    ],
  },
});
