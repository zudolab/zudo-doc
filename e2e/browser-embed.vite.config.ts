import { defineConfig, transformWithEsbuild } from "vite";
import { resolve } from "node:path";

const repoRoot = import.meta.dirname.replace(/\/e2e$/, "");

const preservePackageFunctionNames = {
  name: "browser-embed-preserve-package-function-names",
  enforce: "pre" as const,
  async transform(code: string, id: string) {
    const modulePath = (id.split("?", 1)[0] ?? id).replaceAll("\\", "/");
    if (!modulePath.includes("/packages/zudo-doc/dist/") || !/\.m?js$/.test(modulePath)) {
      return;
    }

    // Keep original names before Rollup deconflicts same-named package exports.
    // The final esbuild pass cannot recover a name Rollup already changed.
    const result = await transformWithEsbuild(code, modulePath, {
      loader: "js",
      keepNames: true,
      target: "esnext",
    });
    return { code: result.code, map: result.map };
  },
};

export default defineConfig({
  base: "/browser-embed/",
  publicDir: false,
  plugins: [preservePackageFunctionNames],
  esbuild: { keepNames: true },
  build: {
    emptyOutDir: false,
    outDir: resolve(repoRoot, "e2e/fixtures/smoke/public/browser-embed"),
    rollupOptions: {
      input: resolve(repoRoot, "e2e/browser-embed/main.tsx"),
      output: {
        entryFileNames: "browser-embed.js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
