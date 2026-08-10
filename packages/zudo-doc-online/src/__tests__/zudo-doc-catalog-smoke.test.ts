// Smoke test for the `@takazudo/zudo-doc` workspace dependency grant
// (zudolab/zudo-doc#3349, epic #3345 "theme catalog single-sourcing"). Proves
// the `./catalog` subpath — the sole authorized import from this dependency
// (epic contract 3) — resolves and carries the shape the wizard/dashboard
// picker cards will read from. A pure-data subpath import; it loads none of
// `@takazudo/zudo-doc`'s zfb/zdtp/katex/diff peer dependencies at runtime.

import { describe, it, expect } from "vitest";
import catalog from "@takazudo/zudo-doc/catalog";

describe("@takazudo/zudo-doc/catalog import", () => {
  it("has 31 packs", () => {
    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.packs.length).toBe(31);
  });

  it("spot-checks preview.light.bg / preview.dark.accent / fonts.sans on the default pack", () => {
    const defaultPack = catalog.packs.find((pack) => pack.slug === "default");
    expect(defaultPack).toBeDefined();
    expect(defaultPack?.preview.light.bg).toBeTruthy();
    expect(defaultPack?.preview.dark.accent).toBeTruthy();
    expect(defaultPack?.fonts.sans).toBeTruthy();
  });
});
