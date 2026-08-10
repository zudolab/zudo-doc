/**
 * Boot entry for the local API server (`pnpm dev:server`).
 *
 * Everything Node-specific about *running* the server lives here: the data
 * directory, the listener, and the seed. `createApp` itself is runtime-neutral.
 *
 * The bind is loopback-only by design. This server has no authentication and
 * writes real files, so it must not be reachable from the network; a
 * `0.0.0.0` bind would hand any machine on the LAN write access to the
 * developer's documentation base.
 */

import { serve } from "@hono/node-server";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createApp } from "./app";
import { EventBus } from "./events";
import { createFileStore } from "./store/file-store";

/** 4321/4322 and 4500-4504 are taken by other tooling in this repo. */
export const DEFAULT_PORT = 4324;
export const DEFAULT_HOSTNAME = "127.0.0.1";

const packageRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

export interface BootOptions {
  dataDir?: string;
  port?: number;
  hostname?: string;
}

export interface BootedServer {
  port: number;
  close: () => Promise<void>;
}

export async function startServer(options: BootOptions = {}): Promise<BootedServer> {
  const dataDir = options.dataDir ?? path.join(packageRoot, "data");
  const store = createFileStore({ dataDir });

  // Heals a commit interrupted by a previous process before anything reads.
  const recovered = await store.recover();
  for (const [slug, outcome] of recovered) {
    console.log(`[api] recovered project "${slug}": ${outcome}`);
  }

  const seeded = await store.seedIfEmpty();
  if (seeded) console.log(`[api] seeded sample project "${seeded}"`);

  const app = createApp({ store, events: new EventBus() });

  return new Promise<BootedServer>((resolve) => {
    const server = serve(
      {
        fetch: app.fetch,
        port: options.port ?? DEFAULT_PORT,
        hostname: options.hostname ?? DEFAULT_HOSTNAME,
      },
      (info) => {
        resolve({
          port: info.port,
          close: () =>
            new Promise<void>((done, fail) => {
              server.close((error) => (error ? fail(error) : done()));
            }),
        });
      },
    );
  });
}

// `tsx watch server/index.ts` runs this file directly; importing it from a
// test must not start a listener.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const booted = await startServer();
  console.log(`[api] listening on http://${DEFAULT_HOSTNAME}:${booted.port}`);
}
