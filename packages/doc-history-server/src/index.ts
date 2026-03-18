#!/usr/bin/env node
import { parseServerArgs } from "./args.js";
import { startServer } from "./server.js";

const options = parseServerArgs(process.argv.slice(2));
startServer(options);
