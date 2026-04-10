/**
 * Extract class names from source files (.tsx, .jsx, .astro).
 *
 * Handles:
 * - className="..." and className={'...'} in TSX/JSX
 * - class="..." and class:list={[...]} in Astro
 * - Template literal classNames (simple cases)
 * - Ignore comments: design-token-lint-ignore
 */
export interface ExtractedClass {
    className: string;
    line: number;
}
/**
 * Extract all class names from file content with their line numbers.
 */
export declare function extractClasses(content: string): ExtractedClass[];
//# sourceMappingURL=extractor.d.ts.map