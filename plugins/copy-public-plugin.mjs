// zfb plugin module: copy-public.
//
// Workaround for upstream zfb gap — `zfb build` does not copy `public/`
// contents to `outDir`. See: zudolab/zudo-doc#1394;
// upstream issue: https://github.com/Takazudo/zudo-front-builder/issues/158
//
// postBuild — recursively copies `<projectRoot>/public/` into
//             `<outDir>/<base>/` so static assets land at the correct
//             base-prefixed URL paths matching what `withBase()` emits.
//
//             Example: with `base = "/pj/zudo-doc/"`, `public/img/logo.svg`
//             becomes `dist/pj/zudo-doc/img/logo.svg`, served at
//             `/pj/zudo-doc/img/logo.svg` by Cloudflare Pages.
//
// Missing or empty `public/` is treated as a no-op (no error).
//
// `options` carries `{ publicDir, base }` from the matching entry in
// `zfb.config.ts`.

import { cp } from "node:fs/promises";
import { join, resolve } from "node:path";

export default {
  name: "copy-public",

  async postBuild(ctx) {
    const { publicDir: publicDirOption, base } = ctx.options;
    const publicDir = resolve(ctx.projectRoot, publicDirOption ?? "public");
    // Strip leading and trailing slashes from base so we can use it as a
    // relative path segment — e.g. "/pj/zudo-doc/" → "pj/zudo-doc".
    const baseSegment = typeof base === "string" ? base.replace(/^\/|\/$/g, "") : "";
    const dest = join(ctx.outDir, baseSegment);

    ctx.logger.info(`copying ${publicDir} → ${dest}`);

    await cp(publicDir, dest, {
      recursive: true,
      force: true,
      errorOnExist: false,
    }).catch((err) => {
      if (err.code === "ENOENT") {
        // publicDir does not exist or is empty — treat as no-op.
        ctx.logger.info("public/ not found — skipping copy");
        return;
      }
      throw err;
    });
  },
};
