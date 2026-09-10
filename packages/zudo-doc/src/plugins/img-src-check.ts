// zfb plugin module: raw HTML image-source existence check.
//
// The preset emits this plugin as a bare-specifier descriptor so the
// node-backed filesystem scanner stays out of config evaluation. The
// `onBroken` option intentionally reuses the setting that controls broken
// markdown links; `ignore` avoids the post-build walk altogether.

import type { ZfbBuildHookContext, ZfbPlugin } from "@takazudo/zfb/plugins";
import { checkImgSrcs, type ImgSrcCheckSeverity } from "./internal/img-src-check/index.js";

function severity(value: unknown): ImgSrcCheckSeverity {
  return value === "error" || value === "ignore" ? value : "warn";
}

const plugin: ZfbPlugin = {
  name: "img-src-check",

  postBuild(ctx: ZfbBuildHookContext) {
    const onBroken = severity(ctx.options["onBroken"]);
    if (onBroken === "ignore") return;

    checkImgSrcs({
      outDir: ctx.outDir,
      base: typeof ctx.options["base"] === "string" ? ctx.options["base"] : "/",
      onBroken,
      logger: ctx.logger,
    });
  },
};

export default plugin;
