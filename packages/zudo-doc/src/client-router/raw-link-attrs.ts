/** Attributes that make a raw asset link bypass zfb's client router. */
export const RAW_LINK_ATTRS = { download: "" } as const;

/** Attributes that make a link perform a full browser reload. */
export const RELOAD_LINK_ATTRS = { "data-zfb-reload": "" } as const;
