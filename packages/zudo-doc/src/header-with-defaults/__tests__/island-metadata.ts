import { afterEach, beforeEach } from "vitest";

interface ZfbTestMetadata {
  zudoReactBuild?: string;
  zudoReactIslands?: readonly string[];
  [key: string]: unknown;
}

type ZfbGlobal = typeof globalThis & { __zfb?: ZfbTestMetadata };

const zfbGlobal = globalThis as ZfbGlobal;
let previousMetadata: ZfbTestMetadata | undefined;

beforeEach(() => {
  previousMetadata = zfbGlobal.__zfb;
  zfbGlobal.__zfb = {
    ...previousMetadata,
    zudoReactBuild: "4459-header-tests",
    zudoReactIslands: [...new Set([
      ...(previousMetadata?.zudoReactIslands ?? []),
      "SidebarToggle",
      "ThemeToggle",
    ])],
  };
});

afterEach(() => {
  if (previousMetadata === undefined) delete zfbGlobal.__zfb;
  else zfbGlobal.__zfb = previousMetadata;
});
