import { beforeEach, describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  defaultLocale: "en",
  getLocaleConfig: vi.fn((_locale: string) => undefined),
  resolveNavSource: vi.fn(() => ({})),
  resolveVersionedLocaleSource: vi.fn(() => ({})),
  versionedDocsUrl: vi.fn((slug: string, version: string) => `/v/${version}/docs/${slug}`),
  buildDocRouteEntries: vi.fn(() => [
    {
      slugParams: ["fallback-page"],
      isFallback: true,
      props: {
        kind: "entry",
        entry: { slug: "fallback-page", data: { title: "Fallback page" } },
      },
    },
  ]),
}));

vi.mock("../_context.js", () => routeState);
vi.mock("../_chrome.js", () => ({ renderDocPage: () => null }));

import { paths as localizedDocPaths } from "../locale-docs-slug.js";
import { paths as versionedDocPaths } from "../v-docs-slug.js";
import { paths as versionedLocalizedDocPaths } from "../v-locale-docs-slug.js";

function expectStrictJson(value: unknown, path = "$"): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throw new Error(`${path}[${index}] is a sparse array hole`);
      }
      expectStrictJson(value[index], `${path}[${index}]`);
    }
    return;
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${path} is not a plain record`);
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new Error(`${path} has symbol keys`);
    }
    for (const key of Object.keys(value)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        throw new Error(`${path}.${key} is a dangerous key`);
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || descriptor.get || descriptor.set) {
        throw new Error(`${path}.${key} is an accessor`);
      }
      expectStrictJson(descriptor.value, `${path}.${key}`);
    }
    return;
  }
  throw new Error(`${path} contains non-JSON ${typeof value}`);
}

function useSettings(settings: Record<string, unknown>) {
  routeState.settings = settings;
}

describe("doc route paths — absence, locale fallback, and strict JSON", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettings({ defaultLocale: "en", docsDir: "src/content/docs", locales: {}, versions: false });
  });

  it("enumerates no localized or versioned pages when their settings are absent", () => {
    expect(localizedDocPaths()).toEqual([]);
    expect(versionedDocPaths()).toEqual([]);
    expect(versionedLocalizedDocPaths()).toEqual([]);
  });

  it("keeps fallback pages at the configured locale and omits no required JSON fields", () => {
    useSettings({
      defaultLocale: "en",
      docsDir: "src/content/docs",
      locales: { ja: { label: "日本語" } },
      versions: false,
    });

    const paths = localizedDocPaths();
    expect(paths).toEqual([
      {
        params: { locale: "ja", slug: ["fallback-page"] },
        props: {
          kind: "entry",
          entry: { slug: "fallback-page", data: { title: "Fallback page" } },
          contentDir: "src/content/docs",
          isFallback: true,
        },
      },
    ]);
    expectStrictJson(paths);
  });

  it("uses the version's base content for localized fallbacks and emits only configured versions", () => {
    useSettings({
      defaultLocale: "en",
      docsDir: "src/content/docs",
      locales: { ja: { label: "日本語" } },
      versions: [
        { slug: "v1", docsDir: "src/content/docs-v1", locales: {} },
      ],
    });

    const localizedPaths = versionedLocalizedDocPaths();
    expect(localizedPaths).toEqual([
      {
        params: { version: "v1", locale: "ja", slug: ["fallback-page"] },
        props: {
          kind: "entry",
          entry: { slug: "fallback-page", data: { title: "Fallback page" } },
          version: { slug: "v1", docsDir: "src/content/docs-v1", locales: {} },
          contentDir: "src/content/docs-v1",
          isFallback: true,
        },
      },
    ]);
    expectStrictJson(localizedPaths);

    const defaultLocalePaths = versionedDocPaths();
    expect(defaultLocalePaths).toHaveLength(1);
    expect(defaultLocalePaths[0]?.params).toEqual({ version: "v1", slug: ["fallback-page"] });
    expectStrictJson(defaultLocalePaths);
  });
});
