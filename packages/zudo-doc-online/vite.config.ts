import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [preact(), tailwindcss()],
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
