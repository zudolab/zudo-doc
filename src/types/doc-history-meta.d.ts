// Ambient declaration for the build-time doc-history manifest.
//
// `.zfb/doc-history-meta.json` is emitted by `scripts/zfb-prebuild.mjs`
// (step 2: doc-history-meta) before `zfb build` runs. It maps composed
// slugs to { author, createdDate, updatedDate } triples derived from git
// history. The `#doc-history-meta` path alias in tsconfig.json resolves
// this alias to the absolute path of the generated file so esbuild can
// find it outside the shadow tree.
//
// An ambient `declare module` is provided here so tsc can type-check
// imports from `pages/` without requiring the generated file to exist
// at type-check time.
declare module "#doc-history-meta" {
  export interface DocHistoryMetaEntry {
    author: string;
    createdDate: string;
    updatedDate: string;
  }
  const meta: Record<string, DocHistoryMetaEntry>;
  export default meta;
}
