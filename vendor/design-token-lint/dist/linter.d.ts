/**
 * Main linter: combines extraction and rule checking.
 */
export interface LintResult {
    filePath: string;
    line: number;
    className: string;
    reason: string;
}
/**
 * Lint a single file for design token violations.
 */
export declare function lintFile(filePath: string): Promise<LintResult[]>;
/**
 * Lint content string (for testing without file I/O).
 */
export declare function lintContent(filePath: string, content: string): LintResult[];
//# sourceMappingURL=linter.d.ts.map