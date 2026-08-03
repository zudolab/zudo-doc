// Consumer-level resolution-chain probe fixture (#3241, #3239, #3237).
//
// This file is the whole point of the fixture: it type-checks ONLY if
// `@takazudo/zudo-doc/tsconfig.base.json`'s top-level `files` array still
// pulls in `zfb-config-shim.d.ts`, which still re-exports the real
// `@takazudo/zfb/config` types. `copyPublicWithBase` is a genuine top-level
// `ZfbConfig` field that a consumer can only reach through that chain — it
// was one of the twelve fields the old hand-copied shim (#3237) had fallen
// behind on. If any link in the chain drops (a `files` entry removed, the
// shim stops re-exporting, `@takazudo/zfb` becomes unresolvable), this file
// fails with TS2307 (`zfb/config` not found) or TS2353 (unknown field), and
// resolution-chain.test.ts turns that into a named CI failure instead of a
// consumer discovering it months later.
import { defineConfig } from "zfb/config";

export default defineConfig({
  copyPublicWithBase: true,
});
