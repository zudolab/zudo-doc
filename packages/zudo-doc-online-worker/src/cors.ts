// CORS allowlist for zudo-doc-online's SPA dev origin (packages/zudo-doc-online,
// `pnpm --filter zudo-doc-online dev` on port 4323). Exported as a constant — a
// later sub-issue's contract test reads this directly to keep the worker's CORS
// policy and the SPA's known origin in lockstep.
export const CORS_CONFIG = {
  origin: ["http://localhost:4323", "http://127.0.0.1:4323"] as string[],
  credentials: false,
  allowHeaders: ["Authorization", "Content-Type"] as string[],
  // Browser JS cannot read a response header that isn't explicitly exposed;
  // the future bearer-token auth flow (epic zudolab/zudo-doc#3361) returns the
  // session token via a `set-auth-token` response header.
  exposeHeaders: ["set-auth-token"] as string[],
  allowMethods: ["GET", "POST", "OPTIONS"] as string[],
};
