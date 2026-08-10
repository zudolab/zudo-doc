// Bearer-session gate for this worker's app-owned /api/* routes
// (epic zudolab/zudo-doc#3361).
//
// FAILS CLOSED on every path — absent header, malformed token, expired or
// revoked session, and a thrown resolution error all produce 401. A thrown
// getSession() must NOT fall through to the app's onError 500 handler, because
// a 500 from an ungated handler chain is indistinguishable from an open gate
// to a caller that only checks for 401.
import type { MiddlewareHandler } from "hono";
import { type AuthEnv, createAuth } from "../auth";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export type AppEnv = {
  Bindings: AuthEnv;
  Variables: {
    user: SessionUser;
  };
};

// Ungated paths. Registration order in index.ts already lets Better Auth's own
// handler answer /api/auth/* before this middleware runs, but the exclusion is
// restated here so a later route reordering cannot accidentally gate Better
// Auth's sign-in endpoints behind a session that only sign-in can produce.
const UNGATED_EXACT_PATHS = new Set(["/api/health"]);
const UNGATED_PATH_PREFIXES = ["/api/auth/"];

function isUngated(pathname: string): boolean {
  return (
    UNGATED_EXACT_PATHS.has(pathname) ||
    UNGATED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (isUngated(new URL(c.req.url).pathname)) {
    return next();
  }

  const unauthorized = () =>
    c.json(
      { error: { code: "unauthorized", message: "Authentication required" } },
      401,
    );

  // HTTP auth schemes are case-insensitive (RFC 9110), and Better Auth
  // lowercases the prefix itself — rejecting `bearer <token>` here would fail a
  // standards-compliant client the auth library would have accepted.
  const authorization = c.req.header("Authorization");
  if (!authorization || !/^bearer\s+\S/i.test(authorization)) {
    return unauthorized();
  }

  // D1 bindings are request-scoped, so the auth instance is built here rather
  // than at module scope (see src/auth.ts).
  const auth = createAuth(c.env);

  // Resolve against the bearer credential ALONE — a session cookie must never
  // stand in for it. Better Auth 1.6.26 already gives an invalid bearer token
  // precedence over an ambient cookie, but that is its internal ordering, not a
  // documented guarantee; forwarding only the Authorization header makes this
  // gate's bearer-only contract independent of that behavior.
  const bearerOnlyHeaders = new Headers({ Authorization: authorization });

  let session: Awaited<ReturnType<typeof auth.api.getSession>>;
  try {
    session = await auth.api.getSession({ headers: bearerOnlyHeaders });
  } catch {
    return unauthorized();
  }

  if (!session?.user) {
    return unauthorized();
  }

  c.set("user", {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  });

  return next();
};
