import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Why this guard exists (#3116, symptom filed as #3114) ──────────────────
// Numeric Tailwind spacing utilities (`w-72`, `h-40`, …) generate NOTHING in
// this project: `src/styles/global.css` imports only `tailwindcss/preflight`
// + `tailwindcss/utilities` (never the default theme), and `theme.css`
// defines only NAMED spacing tokens (`--spacing-hsp-*`, `--spacing-vsp-*`,
// `--spacing-0`, `--spacing-px`) — there is no bare `--spacing`, so Tailwind
// v4 silently drops every numeric spacing candidate. The theme-pack switcher
// flyout shipped with `w-72` in source and NO effective width as a result.
//
// The fix for a caught violation is EITHER an arbitrary value (`w-[360px]`,
// the established local convention — see `max-w-[64rem]` in
// theme-pack-dialog) OR a named token (e.g. `px-hsp-lg`) — NEVER adding a
// bare `--spacing` to `theme.css`. That would switch on Tailwind's WHOLE
// numeric spacing scale, which is exactly what the tight-token policy
// (`packages/zudo-doc/CLAUDE.md`, `src/CLAUDE.md`) intentionally avoids.

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, "../..");
const SRC_DIR = resolve(__dirname, "..");
const repoRoot = resolve(__dirname, "../../../..");

// Reuse the exact candidate-extraction + class-shape-validation logic
// gen-safelist.mjs uses to scan compiled dist/**/*.js for Tailwind class
// candidates (see that file's own header comment for the lexer design),
// rather than a hand-rolled class-shape regex.
const { extractTokens } = await import(resolve(PACKAGE_ROOT, "scripts/gen-safelist.mjs"));

// gen-safelist.mjs's lexer only ever scans COMPILED dist/**/*.js (JSX already
// transformed away by tsup/esbuild). Feeding it raw .tsx source instead
// breaks it: the lexer's regex-vs-division heuristic treats the `/` in a JSX
// closing tag (e.g. `</div>`) as the start of a regex literal — `<` is a
// regex precursor — and everything after gets mis-tokenized (confirmed
// empirically: real class strings like "w-72" go missing entirely). So each
// file is esbuild-transformed (JSX/TS stripped, exactly what tsup does for
// dist) before handing its text to extractTokens — esbuild is not a direct
// dependency of this package; resolve it via vite, same pattern as
// preset.test.ts's node-free eval-graph guard.
interface EsbuildLike {
  transform(input: string, options: Record<string, unknown>): Promise<{ code: string }>;
}
function loadEsbuild(): EsbuildLike {
  const vitePkg = require.resolve("vite/package.json", {
    paths: [process.cwd(), __dirname, repoRoot],
  });
  const viteRequire = createRequire(vitePkg);
  return viteRequire("esbuild") as EsbuildLike;
}

function findSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // __tests__ holds specs/fixtures, not shipped package source.
    if (entry.name === "__tests__") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findSourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

// Prefixes from the #3116 spec that ride Tailwind's NUMERIC spacing scale
// (which resolves against the bare `--spacing` token this project never
// defines). Named tokens (`px-hsp-lg`, `w-icon-sm`, …) don't match this
// shape at all, so they can never be candidates here.
const SPACING_PREFIXES = [
  "w",
  "h",
  "size",
  "min-w",
  "min-h",
  "max-w",
  "max-h",
  "basis",
  "p",
  "px",
  "py",
  "pt",
  "pb",
  "pl",
  "pr",
  "m",
  "mx",
  "my",
  "mt",
  "mb",
  "ml",
  "mr",
  "gap",
  "gap-x",
  "gap-y",
  "space-x",
  "space-y",
  "inset",
  "inset-x",
  "inset-y",
  "top",
  "right",
  "bottom",
  "left",
  "translate-x",
  "translate-y",
  "scroll-m",
  "scroll-mx",
  "scroll-my",
  "scroll-mt",
  "scroll-mb",
  "scroll-ml",
  "scroll-mr",
];

// Anchors the WHOLE candidate token — after optional variant prefixes
// (`lg:`, `hover:`, or an arbitrary selector variant like `[&_nav]:` — this
// codebase uses that form, e.g. breadcrumb.tsx's `[&_nav]:mb-0`) and an
// optional `!`/`-` important/negative marker — to `<prefix>-<digits>`.
// Fractions (`w-1/2`) and arbitrary VALUES (`w-[360px]`) never reach this
// shape: extractTokens keeps the literal `/` and `[...]` characters in the
// token, and this regex requires the token to END immediately after the
// digits.
const VARIANT = "(?:[a-zA-Z0-9_-]+:|\\[[^\\]]*\\]:)*";
const NUMERIC_SPACING_RE = new RegExp(
  `^${VARIANT}!?-?(?:${SPACING_PREFIXES.join("|")})-(\\d+(?:\\.\\d+)?)$`,
);

interface Violation {
  file: string;
  token: string;
}

async function scanForViolations(): Promise<Violation[]> {
  const esbuild = loadEsbuild();
  const files = findSourceFiles(SRC_DIR);
  const violations: Violation[] = [];
  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    const loader = extname(file) === ".tsx" ? "tsx" : "ts";
    const { code } = await esbuild.transform(raw, { loader, jsx: "transform", format: "esm" });
    const tokens = extractTokens(code, new Set<string>());
    for (const token of tokens) {
      const match = token.match(NUMERIC_SPACING_RE);
      // "-0" is excluded: --spacing-0 is a real named token (theme.css).
      // "-px" never matches \d+ in the first place, so it needs no carve-out.
      if (match && match[1] !== "0") {
        violations.push({ file: file.replace(`${repoRoot}/`, ""), token });
      }
    }
  }
  return violations;
}

describe("package source has no inert numeric spacing utilities (#3116)", () => {
  it("contains zero numeric spacing-scale utility candidates", async () => {
    const violations = await scanForViolations();
    if (violations.length > 0) {
      const list = violations.map((v) => `  ${v.file}: "${v.token}"`).join("\n");
      throw new Error(
        "Found numeric Tailwind spacing utilities that generate NOTHING in this project " +
          "(no bare --spacing token is defined — see theme.css and this file's header " +
          `comment):\n${list}\n\n` +
          "Fix: replace each with an arbitrary value (e.g. w-[360px], the established " +
          "convention) or a named spacing token (e.g. px-hsp-lg). Do NOT add a bare " +
          "--spacing to theme.css — that would switch on Tailwind's whole numeric scale, " +
          "against the tight-token policy.",
      );
    }
    expect(violations).toEqual([]);
  });
});
