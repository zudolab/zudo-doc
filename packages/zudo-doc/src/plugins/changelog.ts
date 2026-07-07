// zfb plugin module: changelog.
//
// Wires the package changelog emitter into postBuild. The preset passes only
// serializable config; filesystem work stays in the plugin runtime so
// `preset.ts` remains node-builtin-free under zfb config evaluation.

import type { ZfbBuildHookContext, ZfbPlugin } from "@takazudo/zfb/plugins";
import { emitChangelogs } from "../integrations/changelog/index.js";
import type { ChangelogConfig } from "../integrations/changelog/index.js";

const plugin: ZfbPlugin = {
  name: "changelog",

  async postBuild(ctx: ZfbBuildHookContext) {
    const changelogs = ctx.options["changelogs"];
    if (!Array.isArray(changelogs) || changelogs.length === 0) return;
    emitChangelogs({
      projectRoot: ctx.projectRoot,
      changelogs: changelogs as ChangelogConfig[],
      logger: ctx.logger,
    });
  },
};

export default plugin;
