import type { AstroIntegration } from "astro";

const DOC_HISTORY_SERVER_PORT = 4322;

export function docHistoryIntegration(): AstroIntegration {
  return {
    name: "doc-history",
    hooks: {
      "astro:config:setup": ({ updateConfig, command, logger }) => {
        if (command !== "dev") return;

        logger.info(
          `Proxying /doc-history/* to localhost:${DOC_HISTORY_SERVER_PORT}`,
        );

        updateConfig({
          vite: {
            plugins: [
              {
                name: "doc-history-dev-proxy",
                configureServer(server) {
                  server.middlewares.use((req, res, next) => {
                    const url = req.url ?? "";
                    // Match /doc-history/*.json requests (with optional base path prefix)
                    if (!url.includes("/doc-history/")) {
                      next();
                      return;
                    }

                    // Extract the path starting from /doc-history/
                    const idx = url.indexOf("/doc-history/");
                    const proxyPath = url.slice(idx);

                    const proxyUrl = `http://localhost:${DOC_HISTORY_SERVER_PORT}${proxyPath}`;

                    // Proxy the request to the standalone doc-history server
                    fetch(proxyUrl)
                      .then(async (upstream) => {
                        res.statusCode = upstream.status;
                        res.setHeader(
                          "Content-Type",
                          upstream.headers.get("content-type") ??
                            "application/json",
                        );
                        const body = await upstream.text();
                        res.end(body);
                      })
                      .catch((err) => {
                        const msg =
                          err instanceof Error ? err.message : String(err);
                        logger.warn(
                          `Doc history proxy failed: ${msg}. Is the doc-history server running on port ${DOC_HISTORY_SERVER_PORT}?`,
                        );
                        res.statusCode = 502;
                        res.setHeader("Content-Type", "application/json");
                        res.end(
                          JSON.stringify({
                            error: `Doc history server unavailable (port ${DOC_HISTORY_SERVER_PORT})`,
                          }),
                        );
                      });
                  });
                },
              },
            ],
          },
        });
      },

      "astro:build:done": async ({ logger }) => {
        // Doc history JSONs are generated separately:
        //   - CI: @zudo-doc/doc-history-server generate (build-history job)
        //   - Local: set SKIP_DOC_HISTORY=1 or run the server package manually
        if (process.env.SKIP_DOC_HISTORY === "1") {
          logger.info("Skipping doc history generation (SKIP_DOC_HISTORY=1)");
        } else {
          logger.warn(
            "Doc history not generated during build. " +
              "Set SKIP_DOC_HISTORY=1 to suppress this warning, " +
              "or use @zudo-doc/doc-history-server to generate history JSONs separately.",
          );
        }
      },
    },
  };
}
