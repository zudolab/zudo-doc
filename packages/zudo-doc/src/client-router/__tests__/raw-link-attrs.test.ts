import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RAW_LINK_ATTRS, RELOAD_LINK_ATTRS } from "../raw-link-attrs.js";

const runtimeRouterPath = resolve(
  fileURLToPath(new URL("../../../../../", import.meta.url)),
  "node_modules/@takazudo/zfb-runtime/dist/client-router/router.js",
);

function readHandleClick(): string {
  const source = readFileSync(runtimeRouterPath, "utf8");
  const start = source.indexOf("function handleClick");
  const end = source.indexOf("function handleSubmit", start);
  expect(start, "zfb-runtime client-router handleClick was not found").toBeGreaterThanOrEqual(0);
  expect(end, "zfb-runtime client-router handleSubmit was not found").toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("client-router opt-out attributes", () => {
  it("matches the installed zfb-runtime handleClick contract", () => {
    const handleClick = readHandleClick();
    expect(RAW_LINK_ATTRS).toEqual({ download: "" });
    expect(handleClick).toContain('linkEl.hasAttribute("download")');
    // DOMStringMap turns data-zfb-reload into the zfbReload property used by
    // the runtime's handleClick implementation.
    expect(handleClick).toContain("data-zfb-reload");
    expect(handleClick).toContain(
      'linkEl.dataset["zfbReload"] !== undefined',
    );
    expect(RELOAD_LINK_ATTRS).toEqual({ "data-zfb-reload": "" });
  });
});
