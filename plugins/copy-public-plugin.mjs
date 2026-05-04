// zfb plugin module: copy-public.
//
// Workaround for upstream zfb gap — `zfb build` does not copy `public/`
// contents to `outDir`. See: zudolab/zudo-doc#1394;
// upstream issue: https://github.com/Takazudo/zudo-front-builder/issues/158
//
// postBuild — recursively copies `<projectRoot>/public/` directly into
//             `<outDir>/` (FLAT, matching zfb's own dist/ convention —
//             zfb emits dist/index.html, dist/assets/..., NOT
//             dist/<base>/index.html). The deployed URL prefix is
//             applied uniformly by the deploy pipeline's prepare step
//             (`mkdir -p deploy/<base> && cp -r dist/. deploy/<base>/`
//             in `.github/workflows/preview-deploy.yml`,
//             `pr-checks.yml`, and `main-deploy.yml`), so prefixing
//             here would double-prefix the file path.
//
//             Example: `public/img/logo.svg` becomes `dist/img/logo.svg`,
//             which the deploy prepare step relocates to
//             `deploy/pj/zudo-doc/img/logo.svg`, served at
//             `/pj/zudo-doc/img/logo.svg` by Cloudflare Pages.
//
// Missing or empty `public/` is treated as a no-op (no error).
//
// `options` carries `{ publicDir }` from the matching entry in
// `zfb.config.ts`. The `base` option is intentionally unused — see
// rationale above.

import { cp } from "node:fs/promises";
import { resolve } from "node:path";

export default {
  name: "copy-public",

  async postBuild(ctx) {
    const { publicDir: publicDirOption } = ctx.options;
    const publicDir = resolve(ctx.projectRoot, publicDirOption ?? "public");
    const dest = ctx.outDir;

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
