/**
 * Headless SPA store for zudo-doc online — the transport-agnostic contract,
 * both providers, the revision coordinator, the per-page save machine, and
 * the SSE client. Nothing here touches Preact; surfaces (later epic #3327
 * waves) consume this through thin hooks of their own.
 */

export * from "./client-id";
export * from "./contract";
export * from "./events";
export * from "./http-provider";
export * from "./memory-provider";
export * from "./revision-coordinator";
export * from "./save-machine";
