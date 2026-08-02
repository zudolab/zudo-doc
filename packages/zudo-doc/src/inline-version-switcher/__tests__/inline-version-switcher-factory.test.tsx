/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * Factory tests for createInlineVersionSwitcher (epic #2344, S8).
 *
 * Verifies:
 *  1. Returns undefined when versions is not configured.
 *  2. Returns undefined when versions is an empty array.
 *  3. Returns a JSX element when versions is configured.
 *  4. URL helpers are called with correct args for default vs non-default locale.
 *  5. #3215 — `getUnavailableVersions` drives the `unavailableVersions` prop
 *     passed to `<VersionSwitcher>`: called with the current (slug, locale),
 *     its returned set is passed straight through, and an "undefined" result
 *     (no availability data) passes through as undefined rather than an
 *     empty set.
 */

import { describe, expect, it, vi } from "vitest";
import { createInlineVersionSwitcher } from "../index.js";
import type { InlineVersionSwitcherDeps } from "../index.js";

function makeDeps(overrides: Partial<InlineVersionSwitcherDeps> = {}): InlineVersionSwitcherDeps {
  return {
    settings: {
      versions: [{ slug: "v1", label: "v1.0" }],
    },
    defaultLocale: "en",
    t: (key: string) => key,
    docsUrl: (slug: string, lang?: string) => `/${lang ?? "en"}/docs/${slug}`,
    versionedDocsUrl: (slug: string, versionSlug: string, lang?: string) =>
      `/${lang ?? "en"}/v/${versionSlug}/docs/${slug}`,
    withBase: (path: string) => path,
    getUnavailableVersions: () => undefined,
    ...overrides,
  };
}

describe("createInlineVersionSwitcher — gate: returns undefined when versioning disabled", () => {
  it("returns undefined when settings.versions is false", () => {
    const buildInlineVersionSwitcher = createInlineVersionSwitcher(
      makeDeps({ settings: { versions: false } }),
    );
    expect(buildInlineVersionSwitcher("slug", "en")).toBeUndefined();
  });

  it("returns undefined when settings.versions is an empty array", () => {
    const buildInlineVersionSwitcher = createInlineVersionSwitcher(
      makeDeps({ settings: { versions: [] } }),
    );
    expect(buildInlineVersionSwitcher("slug", "en")).toBeUndefined();
  });
});

describe("createInlineVersionSwitcher — returns element when versioning is enabled", () => {
  it("returns a JSX element for default locale", () => {
    const buildInlineVersionSwitcher = createInlineVersionSwitcher(makeDeps());
    const result = buildInlineVersionSwitcher("getting-started", "en");
    expect(result).not.toBeUndefined();
    expect(result).not.toBeNull();
  });

  it("returns a JSX element for non-default locale", () => {
    const buildInlineVersionSwitcher = createInlineVersionSwitcher(makeDeps());
    const result = buildInlineVersionSwitcher("getting-started", "ja");
    expect(result).not.toBeUndefined();
    expect(result).not.toBeNull();
  });

  it("calls withBase with locale-prefixed versions page URL for non-default locale", () => {
    const withBase = vi.fn((path: string) => path);
    const buildInlineVersionSwitcher = createInlineVersionSwitcher(makeDeps({ withBase }));
    buildInlineVersionSwitcher("getting-started", "ja");
    expect(withBase).toHaveBeenCalledWith(expect.stringContaining("/ja/docs/versions"));
  });

  it("calls withBase with un-prefixed versions page URL for default locale", () => {
    const withBase = vi.fn((path: string) => path);
    const buildInlineVersionSwitcher = createInlineVersionSwitcher(makeDeps({ withBase }));
    buildInlineVersionSwitcher("getting-started", "en");
    expect(withBase).toHaveBeenCalledWith("/docs/versions");
  });

  it("calls docsUrl for the latest URL", () => {
    const docsUrl = vi.fn((slug: string, lang?: string) => `/docs/${slug}#${lang}`);
    const buildInlineVersionSwitcher = createInlineVersionSwitcher(makeDeps({ docsUrl }));
    buildInlineVersionSwitcher("my-page", "en");
    expect(docsUrl).toHaveBeenCalledWith("my-page", "en");
  });

  it("calls versionedDocsUrl for each configured version", () => {
    const versionedDocsUrl = vi.fn(
      (slug: string, vs: string, lang?: string) => `/${lang}/v/${vs}/docs/${slug}`,
    );
    const buildInlineVersionSwitcher = createInlineVersionSwitcher(
      makeDeps({
        settings: { versions: [{ slug: "v1" }, { slug: "v2" }] },
        versionedDocsUrl,
      }),
    );
    buildInlineVersionSwitcher("my-page", "en");
    expect(versionedDocsUrl).toHaveBeenCalledWith("my-page", "v1", "en");
    expect(versionedDocsUrl).toHaveBeenCalledWith("my-page", "v2", "en");
  });
});

describe("createInlineVersionSwitcher — #3215 unavailableVersions wiring", () => {
  it("calls getUnavailableVersions with the current slug and locale, and drives unavailableVersions with the result — a latest-only slug yields that version in the set", () => {
    const getUnavailableVersions = vi.fn(() => new Set(["v1"]));
    const buildInlineVersionSwitcher = createInlineVersionSwitcher(
      makeDeps({ getUnavailableVersions }),
    );
    const result = buildInlineVersionSwitcher("latest-only-page", "en");
    expect(getUnavailableVersions).toHaveBeenCalledWith("latest-only-page", "en");
    expect(result?.props.unavailableVersions).toEqual(new Set(["v1"]));
  });

  it("passes unavailableVersions through as undefined when there is no availability data", () => {
    const getUnavailableVersions = vi.fn(() => undefined);
    const buildInlineVersionSwitcher = createInlineVersionSwitcher(
      makeDeps({ getUnavailableVersions }),
    );
    const result = buildInlineVersionSwitcher("getting-started", "en");
    expect(result?.props.unavailableVersions).toBeUndefined();
  });
});
