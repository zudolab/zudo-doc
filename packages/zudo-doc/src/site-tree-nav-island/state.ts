/** Derive the one-time open state used when a category mounts. */
export function initialCategoryOpenState(initiallyCollapsed: boolean): boolean {
  return !initiallyCollapsed;
}

/** Toggle a mounted category without coupling later state to its initial input. */
export function toggleCategoryOpenState(open: boolean): boolean {
  return !open;
}
