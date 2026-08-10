/**
 * The one project this app opens. The API server seeds it on a fresh checkout
 * (`server/store/file-store.ts` → `seedIfEmpty`); a project picker and
 * multi-project routing are out of scope for epic #3327, so every surface
 * binds to this slug directly.
 *
 * It lives in the shell's own directory rather than in a feature's route file
 * because the shell needs it too, and importing it from
 * `features/outline/route.tsx` would drag that lazily-loaded route into the
 * entry bundle.
 */
export const DEFAULT_PROJECT_SLUG = "aurora-docs";
