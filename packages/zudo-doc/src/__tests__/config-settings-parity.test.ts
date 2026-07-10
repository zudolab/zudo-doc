import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

// ── DRIFT GATE (#2651 review fix) ────────────────────────────────────────────
// `ZudoDocConfig` (config.ts) is the user-facing config surface passed to
// `zudoDoc()`; `Settings` (settings.ts) is the resolved serializable settings
// object the whole runtime reads. A NEW `Settings` field must ALSO appear on
// `ZudoDocConfig` — otherwise a project can never set it via `zudoDoc({...})`
// (it silently sits at its DEFAULT_SETTINGS value forever). This test parses
// both interfaces from source and fails if a `Settings` field is not
// configurable through `ZudoDocConfig`, unless it is explicitly allowlisted
// with a reason.
// ─────────────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const configSrc = readFileSync(resolve(__dirname, "../config.ts"), "utf8");
const settingsSrc = readFileSync(resolve(__dirname, "../settings.ts"), "utf8");

/** Extract the body of `export interface <Name> {` up to the first column-0 `}`.
 *  Safe here because neither interface has a column-0 `}` inside its body (JSDoc
 *  `{@link}` braces are indented, and no field uses a multi-line inline object
 *  literal). */
function interfaceBody(src: string, name: string): string {
  const re = new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`);
  const m = src.match(re);
  if (!m) throw new Error(`Could not locate \`export interface ${name} {\``);
  return m[1]!;
}

/** Top-level field names: two-space-indented `name?:` / `name:` declarations. */
function fieldNames(body: string): Set<string> {
  const names = new Set<string>();
  const re = /^ {2}(\w+)\??\s*:/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) names.add(m[1]!);
  return names;
}

describe("ZudoDocConfig covers every configurable Settings field", () => {
  const zudoDocConfigFields = fieldNames(
    interfaceBody(configSrc, "ZudoDocConfig"),
  );
  const settingsFields = fieldNames(interfaceBody(settingsSrc, "Settings"));

  // Settings fields that are DELIBERATELY not exposed on ZudoDocConfig. Each
  // needs a `reason:`. Currently empty — every Settings field is configurable
  // via zudoDoc() (ZudoDocConfig is a superset: all Settings fields plus the
  // non-serializable escape hatches and shell-passthrough fields).
  const ALLOWLIST: Record<string, string> = {
    // (none) — add `fieldName: "reason: …"` here if a Settings field is ever
    // intentionally made non-configurable via zudoDoc().
  };

  it("both interfaces were parsed (sanity)", () => {
    expect(settingsFields.size).toBeGreaterThan(40);
    expect(zudoDocConfigFields.size).toBeGreaterThan(settingsFields.size - 1);
  });

  it("every Settings field is present on ZudoDocConfig (or explicitly allowlisted)", () => {
    const missing = [...settingsFields].filter(
      (f) => !zudoDocConfigFields.has(f) && !(f in ALLOWLIST),
    );
    expect(
      missing,
      `Settings gained field(s) not configurable via zudoDoc(): ${missing.join(", ")}. ` +
        `Add them to ZudoDocConfig (with a @default JSDoc) or to the ALLOWLIST with a reason.`,
    ).toEqual([]);
  });

  it("no stale ALLOWLIST entries (field removed or now covered)", () => {
    const stale = Object.keys(ALLOWLIST).filter(
      (f) => !settingsFields.has(f) || zudoDocConfigFields.has(f),
    );
    expect(
      stale,
      `ALLOWLIST references field(s) that no longer need excluding: ${stale.join(", ")}. Remove them.`,
    ).toEqual([]);
  });
});
