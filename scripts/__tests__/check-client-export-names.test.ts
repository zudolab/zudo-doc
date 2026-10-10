import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { checkClientExportNames } from "../check-client-export-names.mjs";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function fixture(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "client-export-check-")); dirs.push(dir);
  for (const [name, text] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, text);
  }
  return dir;
}

test("accepts one client component and erased type exports", () => {
  const dir = fixture({ "entry.ts": '"use client"; export type Props = {x: string}; export function Unique() { return null; }' });
  expect(checkClientExportNames([[dir]])).toEqual([]);
});

test("rejects duplicate marker names, including packed-package collisions", () => {
  const dir = fixture({
    "host.ts": '"use client"; export function Shared() { return null; }',
    "package.ts": '"use client"; export function Shared() { return null; }',
  });
  expect(checkClientExportNames([[dir]]).join("\n")).toContain("duplicate client marker Shared");
});

test("rejects callable helper exports", () => {
  const dir = fixture({ "entry.ts": '"use client"; export function Entry() { return null; } export const helper = () => 1;' });
  expect(checkClientExportNames([[dir]]).join("\n")).toContain("callable helper export");
});

test("resolves named and default re-exports", () => {
  const dir = fixture({
    "entry.ts": '"use client"; export { Marker } from "./source"; export { default } from "./default";',
    "other.ts": '"use client"; export function Marker() { return null; }',
    "source.ts": 'export function Marker() { return null; }',
    "default.ts": 'export default function DefaultMarker() { return null; }',
  });
  expect(checkClientExportNames([[dir]]).join("\n")).toContain("duplicate client marker Marker");
});

test("reports unresolved re-exports", () => {
  const dir = fixture({ "entry.ts": '"use client"; export { Missing } from "./absent";' });
  expect(checkClientExportNames([[dir]]).join("\n")).toContain("unresolvable re-export");
});

test("checks fixture applications separately", () => {
  const a = fixture({ "entry.ts": '"use client"; export function Shared() { return null; }' });
  const b = fixture({ "entry.ts": '"use client"; export function Shared() { return null; }' });
  expect(checkClientExportNames([[a], [b]])).toEqual([]);
});

test.skipIf(process.env.ZFB3_SOURCE_RESOLVE !== "1")("root config resolves a public package subpath from source", async () => {
  const { parseIsoDate } = await import("@takazudo/zudo-doc/format-date");
  expect(parseIsoDate("2024-02-29")).toEqual({ year: 2024, month: 2, day: 29 });
});

test("rejects duplicate default export identities", () => {
  const dir = fixture({
    "a.ts": '"use client"; export default function Shared() { return null; }',
    "b.ts": '"use client"; export { default } from "./a";',
  });
  expect(checkClientExportNames([[dir]]).join("\n")).toContain("duplicate client marker Shared");
});
