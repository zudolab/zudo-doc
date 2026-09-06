// VENDORED MIRROR of `@takazudo/zdtp@0.5.1`'s public `/constants` leaf, limited
// to the five symbols `design-token-panel-bootstrap.tsx` consumes.
//
// WHY IT EXISTS (#4009, implemented by #4018): `@takazudo/zdtp` is declared an
// OPTIONAL peerDependency of this package, but a STATIC
// `import … from "@takazudo/zdtp/constants"` in the bootstrap made it a hard
// build-time requirement for every consumer of `@takazudo/zudo-doc/chrome` —
// the chrome graph always reaches the bootstrap, so a project that honored
// `optional: true` and never installed zdtp died at esbuild with
// `Could not resolve "@takazudo/zdtp/constants"`. Vendoring these four data
// constants plus one pure function removes that package edge entirely; the
// panel payload itself stays behind the rejection-handled
// `import("@takazudo/zdtp")` in `loadZdtp()`, which esbuild tolerates by
// leaving the bare specifier in the output.
//
// WHY IT MAY BE TRUSTED: `src/__tests__/design-token-panel-constants-conformance.test.ts`
// asserts this module against the REAL `@takazudo/zdtp/constants` (installed in
// this repo) on every default-lane test run — data by value, `matchesKey` and
// `resolveToggleEventName` behaviourally. Drift inside the `^0.5.1` peer range
// fails there. Update this file only together with that test.
//
// This is a MIRROR, not a fork: do not add symbols the bootstrap does not use,
// and do not "improve" the shapes below — they must stay byte-equal to upstream.

/** Default storage-key prefix used by the single-panel configuration. */
export const DEFAULT_STORAGE_PREFIX = "zudo-design-token-panel";

/** Historical public window-event name for the default panel instance. */
export const DEFAULT_TOGGLE_EVENT = "toggle-design-token-panel";

/**
 * Resolve the window-event name that toggles a panel instance.
 *
 * The default prefix keeps the historical event name, even when a host
 * supplies a `toggleEvent`. Other prefixes honor an explicit event name and
 * otherwise derive one from the prefix.
 */
export function resolveToggleEventName(cfg: {
  storagePrefix?: string;
  toggleEvent?: string;
}): string {
  return cfg.storagePrefix === undefined || cfg.storagePrefix === DEFAULT_STORAGE_PREFIX
    ? DEFAULT_TOGGLE_EVENT
    : (cfg.toggleEvent ?? `toggle-${cfg.storagePrefix}`);
}

/**
 * The five fixed eager-load signals, keyed by suffix relative to storagePrefix.
 * Only acceptedValues activate a flag; presence alone is insufficient.
 * requiredConfig means that property must be !== undefined in the panel config.
 * This excludes preference keys and is NOT the whole gate: also inspect
 * EAGER_LOAD_GATE_STATE_FAMILY, whose keys require a content check.
 *
 * `as const` is load-bearing, not cosmetic: `hasPersistedPanelState` indexes
 * `config[gate.requiredConfig]`, which only typechecks while `requiredConfig`
 * narrows to `null | "domTweaker"` instead of widening to `string | null`.
 */
export const EAGER_LOAD_GATE_KEY_SUFFIXES = {
  ":visible": { acceptedValues: ["1"], requiredConfig: null },
  "-open": { acceptedValues: ["1"], requiredConfig: null },
  ":autoload": { acceptedValues: ["1", "auto"], requiredConfig: null },
  "-elpath-enabled": { acceptedValues: ["1"], requiredConfig: null },
  "-domtweaker-enabled": { acceptedValues: ["1"], requiredConfig: "domTweaker" },
} as const;

/**
 * The single registry of state-key suffixes the current loader can read.
 * Mirrors upstream's `READABLE_STATE_KEY_SUFFIXES`, which is deliberately NOT
 * re-exported here — the bootstrap never imported it, and the one in-repo
 * consumer (`design-token-panel-bootstrap.test.ts`) keeps importing the real
 * one from `@takazudo/zdtp/constants`.
 */
const READABLE_STATE_KEY_SUFFIXES = {
  v1: "-state",
  v2: "-state-v2",
  v3: "-state-v3",
  v4: "-state-v4",
} as const;

/**
 * The sixth eager-load signal: exact readable state keys, with a content
 * check. Missing keys and raw empty strings are blank;
 * JSON null and empty objects/arrays do not activate. Non-empty collections and
 * all other parsed primitives (even false, 0, or JSON "") activate. Malformed
 * JSON fails open so the panel can migrate or reject the stored payload.
 *
 * matchesKey compares complete strings constructed from the literal prefix, so
 * regex metacharacters are safe and sibling-instance keys are excluded.
 */
export const EAGER_LOAD_GATE_STATE_FAMILY = {
  keySuffixes: READABLE_STATE_KEY_SUFFIXES,
  matchesKey(storagePrefix: string, key: string): boolean {
    return Object.values(READABLE_STATE_KEY_SUFFIXES).some(
      (suffix) => key === storagePrefix + suffix,
    );
  },
  valueRules: {
    blank: false,
    jsonNull: false,
    object: "non-empty",
    array: "non-empty",
    primitive: true,
    malformedJson: true,
  },
} as const;
