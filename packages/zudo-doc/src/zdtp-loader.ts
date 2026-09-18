// The design-token-panel bootstrap's ONLY route to `@takazudo/zdtp` (#4201).
// `loadZdtp()` imports THIS subpath by its bare package name rather than
// `@takazudo/zdtp` directly, so that when zdtp is not bundled
// (`bundleZdtp ?? designTokenPanel` is false) the preset's
// `zdtp-loader` plugin can shadow exactly this specifier with a
// throwing virtual module — the island build then never bundles zdtp's lazy
// chunks. Shadowing the bare `@takazudo/zdtp` instead would hijack a host's
// own zdtp imports.
export * from "@takazudo/zdtp";
