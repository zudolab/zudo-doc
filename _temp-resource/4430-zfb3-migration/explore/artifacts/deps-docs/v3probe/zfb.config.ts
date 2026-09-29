import { defineConfig } from "zfb/config";

/**
 * The wind configuration owns this starter's palette, scales, reset, and
 * theme binding. Other defaults such as `outDir` and `publicDir` stay implicit.
 *
 * `zfb/config` is a bare specifier the config loader aliases to an
 * internal stub at parse time, so the config is readable without any
 * package installed. `components/zfb-shim.d.ts` gives your editor and
 * `zfb check` the matching types.
 */
export default defineConfig({
  // All utility values are project owned; the engine supplies no default palette.
  wind: {
    spec: 1,
    reset: "owned-v1",
    tokens: {
      spacingUnit: "0.25rem",
      colors: {
        accent: "var(--color-accent)",
        white: "#ffffff",
        "neutral-50": "#fafafa",
        "neutral-100": "#f5f5f5",
        "neutral-200": "#e5e5e5",
        "neutral-300": "#d4d4d4",
        "neutral-400": "#a3a3a3",
        "neutral-500": "#737373",
        "neutral-600": "#525252",
        "neutral-700": "#404040",
        "neutral-800": "#262626",
        "neutral-900": "#171717",
        "neutral-950": "#0a0a0a",
        "sky-50": "#f0f9ff",
        "sky-300": "#7dd3fc",
        "sky-500": "#0ea5e9",
        "sky-700": "#0369a1",
        "sky-950": "#082f49",
        "emerald-50": "#ecfdf5",
        "emerald-300": "#6ee7b7",
        "emerald-500": "#10b981",
        "emerald-700": "#047857",
        "emerald-950": "#022c22",
        "violet-50": "#f5f3ff",
        "violet-300": "#c4b5fd",
        "violet-500": "#8b5cf6",
        "violet-700": "#6d28d9",
        "violet-950": "#2e1065",
        "amber-50": "#fffbeb",
        "amber-300": "#fcd34d",
        "amber-500": "#f59e0b",
        "amber-700": "#b45309",
        "amber-950": "#451a03",
        "rose-50": "#fff1f2",
        "rose-300": "#fda4af",
        "rose-500": "#f43f5e",
        "rose-700": "#be123c",
        "rose-950": "#4c0519",
      },
      sizes: {
        "2xl": "42rem",
      },
      fontSizes: {
        xs: {
          size: "0.75rem",
          lineHeight: "1rem",
        },
        sm: {
          size: "0.875rem",
          lineHeight: "1.25rem",
        },
        lg: {
          size: "1.125rem",
          lineHeight: "1.75rem",
        },
        "2xl": {
          size: "1.5rem",
          lineHeight: "2rem",
        },
        "3xl": {
          size: "1.875rem",
          lineHeight: "2.25rem",
        },
      },
      fontFamilies: {
        mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
      },
      fontWeights: {
        medium: "500",
        semibold: "600",
      },
      lineHeights: {
        relaxed: "1.625",
      },
      letterSpacings: {
        tight: "-0.025em",
      },
      radii: {
        md: "0.375rem",
      },
    },
    breakpoints: {
      sm: {
        minWidthPx: 640,
      },
    },
    dark: {
      attribute: "data-theme",
      value: "dark",
    },
    authoredClasses: {
      prose: true,
    },
  },

  collections: [
    {
      name: "blog",
      path: "content/blog",
      // Enforced by `pnpm typecheck` (`zfb check`), not at build time —
      // a post missing `title`/`date` is reported as a schema violation.
      schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          date: { type: "string" },
          description: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["title", "date"],
      },
    },
  ],

  markdown: {
    // A partial object only overrides the keys it names, so strikethrough,
    // tables, and autolink literals keep their on-by-default values; task
    // lists and footnotes are the additional opt-ins.
    gfm: {
      taskListItem: true,
      footnoteDefinition: true,
    },
    features: {
      // `> [!NOTE]` blockquotes become <Note>/<Tip>/… components, resolved
      // through the project-root `mdx-components.tsx` map.
      githubAlerts: true,
      // Object form turns the feature on with all three sub-features
      // (diff markers, line highlight, word highlight) enabled.
      codeEnrichment: {},
      // Inserts a table of contents after a `## TOC` heading.
      headingMarkerToc: true,
    },
  },
});
