import { emitChangelogs } from "../packages/zudo-doc/src/integrations/changelog/index.js";
import { settings } from "../src/config/settings.js";

const changelogs = settings.changelogs;

if (!Array.isArray(changelogs) || changelogs.length === 0) {
  console.log("No changelog outputs configured.");
  process.exit(0);
}

const result = emitChangelogs({
  projectRoot: process.cwd(),
  changelogs,
  logger: {
    info(message: string) {
      console.log(message);
    },
  },
});

for (const file of result.written) {
  console.log(`Wrote ${file}`);
}
