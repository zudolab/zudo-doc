/**
 * Thin re-export of the smoke fixture's dist reader, kept so the many
 * existing `import { readDistFile } from "./smoke-dist-helper"` call sites
 * across smoke-*.spec.ts keep working unchanged. New specs targeting a
 * different fixture should call `makeDistReader(fixtureName)` from
 * "./dist-helper" directly (zudolab/zudo-doc#2537).
 */
import { makeDistReader } from "./dist-helper";

const smokeDistReader = makeDistReader("smoke");

export const DIST_DIR = smokeDistReader.DIST_DIR;
export const readDistFile = smokeDistReader.readDistFile;
