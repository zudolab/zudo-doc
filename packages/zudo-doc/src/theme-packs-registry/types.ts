// theme-packs-registry/types — the pure registry type surface.
//
// Keep these aliases on the browser-safe side of the registry split. The
// filesystem loader has its own module (`load-registry.ts`) and must never be
// reached by the public `./theme-packs-registry` barrel, including through an
// emitted declaration import.

export type {
  ThemePackRegistry,
  ThemePackRegistryEntry,
} from "../route-context-payload/types.js";
