#!/usr/bin/env node
import { startServer } from "./server.js";

function parseArgs(args: string[]): {
  port: number;
  contentDir: string;
  locales: Array<{ key: string; dir: string }>;
  maxEntries: number;
} {
  let port = 4322;
  let contentDir = "";
  const locales: Array<{ key: string; dir: string }> = [];
  let maxEntries = 50;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--port":
        port = Number(args[++i]);
        break;
      case "--content-dir":
        contentDir = args[++i];
        break;
      case "--locale": {
        const val = args[++i];
        const colonIdx = val.indexOf(":");
        if (colonIdx === -1) {
          console.error(`Invalid --locale format: ${val} (expected key:dir)`);
          process.exit(1);
        }
        locales.push({
          key: val.slice(0, colonIdx),
          dir: val.slice(colonIdx + 1),
        });
        break;
      }
      case "--max-entries":
        maxEntries = Number(args[++i]);
        break;
      default:
        if (args[i].startsWith("--")) {
          console.error(`Unknown option: ${args[i]}`);
          process.exit(1);
        }
    }
  }

  if (!contentDir) {
    console.error("Missing required --content-dir option");
    console.error(
      "Usage: doc-history-server --content-dir <path> [--port <n>] [--locale <key>:<dir>] [--max-entries <n>]",
    );
    process.exit(1);
  }

  return { port, contentDir, locales, maxEntries };
}

const options = parseArgs(process.argv.slice(2));
startServer(options);
