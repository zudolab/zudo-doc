/** Copy transport data before constructing descriptions so SSR and the island
 * serializer observe the same own keys. Optional record members are omitted;
 * malformed arrays and runtime objects fail at the boundary. */
export function normalizeIslandData<T>(value: T): T {
  const active = new WeakSet<object>();
  function copy(input: unknown, path: string): unknown {
    if (input === undefined && path === "$island") return input;
    if (input === null || typeof input === "string" || typeof input === "boolean") {
      return input;
    }
    if (typeof input === "number" && Number.isFinite(input)) return input;
    if (typeof input !== "object") throw new TypeError(`Invalid island data at ${path}`);
    if (active.has(input)) throw new TypeError(`Cyclic island data at ${path}`);
    const prototype = Object.getPrototypeOf(input);
    if (!Array.isArray(input) && prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`Invalid island record at ${path}`);
    }
    active.add(input);
    try {
      if (Array.isArray(input)) {
        for (const key of Reflect.ownKeys(input)) {
          if (
            key !== "length" &&
            (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= input.length)
          ) {
            throw new TypeError(`Invalid island array key at ${path}`);
          }
        }
        return Array.from({ length: input.length }, (_, index) => {
          const descriptor = Object.getOwnPropertyDescriptor(input, index);
          if (!descriptor) throw new TypeError(`Sparse island array at ${path}[${index}]`);
          if (!("value" in descriptor)) {
            throw new TypeError(`Accessor island data at ${path}[${index}]`);
          }
          return copy(descriptor.value, `${path}[${index}]`);
        });
      }
      const output: Record<string, unknown> = {};
      for (const key of Reflect.ownKeys(input)) {
        if (
          typeof key !== "string" ||
          key === "__proto__" ||
          key === "constructor" ||
          key === "prototype"
        ) {
          throw new TypeError(`Invalid island key at ${path}`);
        }
        const descriptor = Object.getOwnPropertyDescriptor(input, key);
        if (!descriptor || !("value" in descriptor)) {
          throw new TypeError(`Accessor island data at ${path}.${key}`);
        }
        if (descriptor.value !== undefined) output[key] = copy(descriptor.value, `${path}.${key}`);
      }
      return output;
    } finally {
      active.delete(input);
    }
  }
  return copy(value, "$island") as T;
}
