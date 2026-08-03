// Package-shipped type shim for the bare `zfb/config` specifier (#2656, #3237).
//
// `zfb.config.ts` imports from the *bare* specifier `zfb/config`, which zfb's
// config loader aliases to a runtime-only stub at parse time
// (`zfb-config-stub.mjs` — `defineConfig` is identity, carrying no types). No
// real file backs `zfb/config` in `node_modules`, so an ambient declaration is
// what supplies its type. An ambient `declare module` wins over node
// resolution AND over tsconfig `paths`, so this file — not any `paths` entry —
// is what `zfb check` (plain `tsc --noEmit`) binds `zfb.config.ts` against.
//
// It re-exports the real, installed `@takazudo/zfb/config` rather than
// restating its shape. There is NO hand-sync duty: this file tracks whatever
// `@takazudo/zfb` version the consumer has installed, automatically. The
// previous hand-copied field list drifted twice — `bundle`
// (Takazudo/zudo-front-builder#678 + zudolab/zudo-doc#1834) and then 12
// top-level fields including `copyPublicWithBase` (#3237) — each drift
// surfacing as a TS2353 on a config field the engine already honoured.
//
// Do NOT add a top-level `import`/`export` to this file: that would turn it
// into a module and the `declare module` would stop being ambient. The
// `export *` must stay INSIDE the block.
//
// Pulled into a consuming project via `tsconfig.base.json`'s
// `files: ["./zfb-config-shim.d.ts", "./virtual-modules.d.ts"]`.

declare module "zfb/config" {
  export * from "@takazudo/zfb/config";
}
