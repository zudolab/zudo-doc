#!/usr/bin/env node
import { parseServerArgs } from "./args.js";
import { startServer } from "./server.js";

const options = parseServerArgs(process.argv.slice(2));
console.log(`doc-history-server: content-dir resolved to ${options.contentDir}`);
for (const locale of options.locales) {
  console.log(`doc-history-server: locale ${locale.key} resolved to ${locale.dir}`);
}
startServer(options);
