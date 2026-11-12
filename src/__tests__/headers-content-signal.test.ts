import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderContentSignal } from "@takazudo/zudo-doc/robots";
import { settings } from "../config/settings";

describe("public/_headers Content-Signal", () => {
  it("sends the value robots.txt publishes from settings.contentSignals", () => {
    const headers = readFileSync(new URL("../../public/_headers", import.meta.url), "utf8");
    const rule = /^\/\*\n((?:[ \t]+.+\n?)+)/m.exec(headers);
    const values = [...(rule?.[1] ?? "").matchAll(/^[ \t]+Content-Signal:[ \t]*(.+)$/gm)].map((match) => match[1]!.trim());
    expect(values).toEqual([renderContentSignal(settings.contentSignals)]);
    expect(values[0]).toBe("search=yes, ai-input=yes, ai-train=no");
  });
});
