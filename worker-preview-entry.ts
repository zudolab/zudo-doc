import adapterWorker from "./dist/_worker.js";

// Cloudflare does not generate preview URLs for a Worker version that
// implements a Durable Object. Preview uploads therefore use this adapter-only
// entry on a separate service; production continues to use worker-entry.ts.
export default adapterWorker;
