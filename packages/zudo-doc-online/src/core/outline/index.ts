/**
 * Headless outline core — the shared model behind the SPA, the local API
 * server and the MCP agent surface. Nothing here touches the DOM or a
 * rendering library, so it runs unchanged in a browser, in Node, and in tests.
 */

export * from "./types";
export * from "./slugs";
export * from "./revision";
export * from "./commands";
export * from "./site-map";
