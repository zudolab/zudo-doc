import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [preact(), tailwindcss()],
  optimizeDeps: {
    // The wasm package's browser entry imports its wasm-bindgen glue via
    // `...zfb-resource.mjs?url` + `new URL(href, import.meta.url)`. Vite's DEV
    // dependency optimizer (esbuild prebundle) does not honor the `?url`
    // suffix there and inlines the glue module, turning the href into the
    // glue's default-export FUNCTION — `new URL(fn, base)` then stringifies
    // function source into a 404ing path and the preview engine retries
    // forever. Production builds (Rollup) are unaffected. Excluding the
    // package keeps the dev server loading it untransformed.
    exclude: ["@takazudo/zfb-md-wasm"],
  },
  resolve: {
    alias: {
      // React → Preact compat aliases. This app runs Preact in React-compat
      // mode (CodeMirror-vim, dnd-kit, and MCP-adjacent UI code target the
      // React API surface). Most-specific key first so `react/jsx-runtime`
      // is not swallowed by the `react` entry.
      "react/jsx-runtime": "preact/jsx-runtime",
      "react-dom": "preact/compat",
      react: "preact/compat",
    },
  },
  server: {
    port: 4323,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4324",
        changeOrigin: true,
      },
    },
  },
});
