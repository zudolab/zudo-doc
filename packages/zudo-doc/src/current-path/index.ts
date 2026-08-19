// Single source of truth for the explicit current-route override
// (zudolab/zudo-doc#3398, consolidated by #3408; resolves #3405).
//
// An embedding host may set `document.documentElement.dataset.zdCurrentPath`
// before `location.pathname` is trustworthy: inside an iframe `srcdoc`
// document, `location.pathname` is the literal string "srcdoc" (matches no
// route) and Chromium refuses `history.replaceState` there, so the page cannot
// self-correct via navigation (spike ledger adl-0005).
//
// Four surfaces read it — `sidebar-tree-island/index.tsx` imports directly;
// `header/nav-overflow-script.ts`, `i18n-version/version-switcher.tsx`, and
// `i18n-version/language-switcher.tsx` are string-embedded client scripts.
// The header's embedding is frozen at package build time by
// `scripts/gen-nav-overflow-script.mjs`, which reads CURRENT_PATH_SCRIPT_PRELUDE
// as a value off this module's exports and splices it into the committed
// `header/nav-overflow-generated-script.ts` literal (zudolab/zudo-doc#3534);
// the other two surfaces still splice it in live, at their own module-eval
// time. Nothing here may close over module scope, because `readCurrentPath`
// is serialized with `Function.prototype.toString()` into those script
// strings.

/**
 * The `dataset` property name of the current-route override — i.e. the
 * `data-zd-current-path` attribute on `<html>`.
 */
export const CURRENT_PATH_DATASET_KEY = "zdCurrentPath";

/**
 * Resolve the current route. Read order is explicit input → dataset override →
 * `window.location.pathname`; `||` (not `??`) so an empty string at any step
 * falls through to the next source rather than winning.
 *
 * `datasetKey` is a parameter rather than a closed-over reference to
 * {@link CURRENT_PATH_DATASET_KEY} so the function body stays self-contained
 * when {@link CURRENT_PATH_SCRIPT_PRELUDE} serializes it into a client script.
 *
 * Returns `undefined` only when no source resolves (SSR); callers that treat a
 * route as optional must handle that, and a resolved value may still match no
 * route (e.g. the literal "srcdoc").
 */
export function readCurrentPath(datasetKey: string, explicit?: string): string | undefined {
  const override =
    typeof document === "undefined" ? undefined : document.documentElement.dataset[datasetKey];
  return (
    explicit || override || (typeof window === "undefined" ? undefined : window.location.pathname)
  );
}

/**
 * JS source declaring `readCurrentPath` and `CURRENT_PATH_DATASET_KEY` inside
 * an inline client script, so a string-embedded reader calls
 * `readCurrentPath(CURRENT_PATH_DATASET_KEY)` with the exact same key the
 * TypeScript call sites use. Splice this into the script body before the first
 * call.
 */
export const CURRENT_PATH_SCRIPT_PRELUDE =
  `var CURRENT_PATH_DATASET_KEY=${JSON.stringify(CURRENT_PATH_DATASET_KEY)};` +
  `var readCurrentPath=${readCurrentPath.toString()};`;
