// zfb plugin module — claude-resources.
//
// Stub created so the plugin name resolves at config-load time (zfb's
// config-loader resolves every `plugins[i].name` to an absolute module
// specifier; an unresolvable name aborts dev / build before the plugin
// host even spawns). The actual `preBuild` hook that runs the
// claude-resources copier is owned by sibling epic task T3 — that task
// edits this file to add the matching exported function. T5 only
// touches `devMiddleware` (the doc-history / search-index / llms-txt
// trio); claude-resources has no dev middleware, so this module is a
// no-op for now.

export default {
  name: "claude-resources",
};
