// Fixture copy of the package-shipped `zfb/config` ambient shim (#3237).
// Re-exports the real, installed `@takazudo/zfb/config` — no hand-copied
// shape, no sync duty. See `packages/zudo-doc/zfb-config-shim.d.ts` for the
// full rationale.

declare module "zfb/config" {
  export * from "@takazudo/zfb/config";
}
