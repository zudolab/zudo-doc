// Sample gated route — proves the requireSession middleware populates
// c.var.user and that /api/* is closed to unauthenticated callers.
import type { Handler } from "hono";
import type { AppEnv } from "../middleware/require-session";

export const meRoute: Handler<AppEnv> = (c) => {
  const { id, email, name } = c.get("user");
  return c.json({ user: { id, email, name } });
};
