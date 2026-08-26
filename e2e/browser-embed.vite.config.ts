import { defineConfig } from "vite";
import { resolve } from "node:path";

const repoRoot = import.meta.dirname.replace(/\/e2e$/, "");

export default defineConfig({
  base: "/browser-embed/",
  publicDir: false,
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
