import { describe, it, expect } from "vitest";
import { rewriteFileDeps } from "../lib/rewrite-file-deps.mjs";

describe("rewriteFileDeps", () => {
  it("rewrites file:../ deps to absolute paths", () => {
    const pkgJson = {
      dependencies: {
        "@takazudo/zfb": "file:../zfb/packages/zfb",
        "@takazudo/zfb-adapter-cloudflare": "file:../zfb/packages/zfb-adapter-cloudflare",
        "@takazudo/zfb-runtime": "file:../zfb/packages/zfb-runtime",
      },
    };

    const result = rewriteFileDeps(pkgJson, "/home/user/repos/zudo-doc");

    expect(result.rewritten).toBe(true);
    expect(result.log).toHaveLength(3);
    expect(result.pkgJson.dependencies?.["@takazudo/zfb"]).toBe(
      "file:/home/user/repos/zfb/packages/zfb",
    );
    expect(result.pkgJson.dependencies?.["@takazudo/zfb-adapter-cloudflare"]).toBe(
      "file:/home/user/repos/zfb/packages/zfb-adapter-cloudflare",
    );
    expect(result.pkgJson.dependencies?.["@takazudo/zfb-runtime"]).toBe(
      "file:/home/user/repos/zfb/packages/zfb-runtime",
    );
  });

  it("does not rewrite file:./ (same-repo) deps", () => {
    const pkgJson = {
      dependencies: {
        "@zudolab/design-token-lint": "file:./vendor/design-token-lint",
      },
    };

    const result = rewriteFileDeps(pkgJson, "/home/user/repos/zudo-doc");

    expect(result.rewritten).toBe(false);
    expect(result.log).toHaveLength(0);
    expect(result.pkgJson.dependencies?.["@zudolab/design-token-lint"]).toBe(
      "file:./vendor/design-token-lint",
    );
  });

  it("does not rewrite non-file: deps", () => {
    const pkgJson = {
      dependencies: {
        astro: "^4.0.0",
        react: "^18.0.0",
        "some-pkg": "workspace:*",
      },
    };

    const result = rewriteFileDeps(pkgJson, "/home/user/repos/zudo-doc");

    expect(result.rewritten).toBe(false);
    expect(result.log).toHaveLength(0);
    expect(result.pkgJson).toEqual(pkgJson);
  });

  it("rewrites deps in devDependencies", () => {
    const pkgJson = {
      devDependencies: {
        "@some/local-dep": "file:../sibling-repo/packages/dep",
      },
    };

    // repoRoot="/abs/repo/root", spec="../sibling-repo/packages/dep"
    // resolve("/abs/repo/root", "../sibling-repo/packages/dep") = "/abs/repo/sibling-repo/packages/dep"
    const result = rewriteFileDeps(pkgJson, "/abs/repo/root");

    expect(result.rewritten).toBe(true);
    expect(result.pkgJson.devDependencies?.["@some/local-dep"]).toBe(
      "file:/abs/repo/sibling-repo/packages/dep",
    );
  });

  it("rewrites deps in peerDependencies", () => {
    const pkgJson = {
      peerDependencies: {
        "@peer/dep": "file:../peer-repo/packages/dep",
      },
    };

    // resolve("/abs/repo", "../peer-repo/packages/dep") = "/abs/peer-repo/packages/dep"
    const result = rewriteFileDeps(pkgJson, "/abs/repo");

    expect(result.rewritten).toBe(true);
    expect(result.pkgJson.peerDependencies?.["@peer/dep"]).toBe(
      "file:/abs/peer-repo/packages/dep",
    );
  });

  it("rewrites deps in optionalDependencies", () => {
    const pkgJson = {
      optionalDependencies: {
        "@opt/dep": "file:../opt-repo/pkg",
      },
    };

    // resolve("/root", "../opt-repo/pkg") = "/opt-repo/pkg"
    const result = rewriteFileDeps(pkgJson, "/root");

    expect(result.rewritten).toBe(true);
    expect(result.pkgJson.optionalDependencies?.["@opt/dep"]).toBe(
      "file:/opt-repo/pkg",
    );
  });

  it("handles multiple dep groups at once", () => {
    const pkgJson = {
      dependencies: {
        "@a/pkg": "file:../repo-a/packages/pkg",
      },
      devDependencies: {
        "@b/pkg": "file:../repo-b/packages/pkg",
        "@c/npm": "^1.0.0",
      },
    };

    // resolve("/workspace/zudo-doc", "../repo-a/packages/pkg") = "/workspace/repo-a/packages/pkg"
    const result = rewriteFileDeps(pkgJson, "/workspace/zudo-doc");

    expect(result.rewritten).toBe(true);
    expect(result.log).toHaveLength(2);
    expect(result.pkgJson.dependencies?.["@a/pkg"]).toBe(
      "file:/workspace/repo-a/packages/pkg",
    );
    expect(result.pkgJson.devDependencies?.["@b/pkg"]).toBe(
      "file:/workspace/repo-b/packages/pkg",
    );
    expect(result.pkgJson.devDependencies?.["@c/npm"]).toBe("^1.0.0");
  });

  it("does not mutate the original pkgJson object", () => {
    const pkgJson = {
      dependencies: {
        "@takazudo/zfb": "file:../zfb/packages/zfb",
      },
    };
    const original = JSON.parse(JSON.stringify(pkgJson));

    rewriteFileDeps(pkgJson, "/home/user/repos/zudo-doc");

    expect(pkgJson).toEqual(original);
  });

  it("log entries include field name, package name, old and new spec", () => {
    const pkgJson = {
      dependencies: {
        "@takazudo/zfb": "file:../zfb/packages/zfb",
      },
    };

    const result = rewriteFileDeps(pkgJson, "/home/user/repos/zudo-doc");

    expect(result.log).toHaveLength(1);
    expect(result.log[0]).toContain("dependencies.@takazudo/zfb");
    expect(result.log[0]).toContain("file:../zfb/packages/zfb");
    expect(result.log[0]).toContain("→");
    expect(result.log[0]).toContain("file:/home/user/repos/zfb/packages/zfb");
  });

  it("returns an empty result for a package.json with no dep fields", () => {
    const pkgJson = {
      name: "my-pkg",
      version: "1.0.0",
    };

    const result = rewriteFileDeps(pkgJson, "/some/root");

    expect(result.rewritten).toBe(false);
    expect(result.log).toHaveLength(0);
    expect(result.pkgJson).toEqual(pkgJson);
  });

  it("handles a realistic zudo-doc package.json with mixed dep types", () => {
    const pkgJson = {
      name: "zudo-doc",
      version: "0.0.1",
      dependencies: {
        "@takazudo/zfb": "file:../zfb/packages/zfb",
        "@takazudo/zfb-adapter-cloudflare": "file:../zfb/packages/zfb-adapter-cloudflare",
        "@takazudo/zfb-runtime": "file:../zfb/packages/zfb-runtime",
        "@zudolab/design-token-lint": "file:./vendor/design-token-lint",
        preact: "^10.24.3",
      },
    };

    const result = rewriteFileDeps(pkgJson, "/home/takazudo/repos/zudo-doc");

    // Only the file:../ deps get rewritten
    expect(result.rewritten).toBe(true);
    expect(result.log).toHaveLength(3);
    expect(result.pkgJson.dependencies?.["@takazudo/zfb"]).toBe(
      "file:/home/takazudo/repos/zfb/packages/zfb",
    );
    expect(result.pkgJson.dependencies?.["@takazudo/zfb-adapter-cloudflare"]).toBe(
      "file:/home/takazudo/repos/zfb/packages/zfb-adapter-cloudflare",
    );
    // file:./ left alone
    expect(result.pkgJson.dependencies?.["@zudolab/design-token-lint"]).toBe(
      "file:./vendor/design-token-lint",
    );
    // npm dep left alone
    expect(result.pkgJson.dependencies?.["preact"]).toBe("^10.24.3");
  });
});
