/**
 * Configuration loader for design-token-lint.
 *
 * Loads a JSON config file from the project root, falling back to
 * built-in defaults if no config is found.
 */
export interface LintConfig {
    /** Patterns to flag as violations. Placeholders: {n} = number, {color} = Tailwind color, {shade} = shade (50-950) */
    prohibited: string[];
    /** Exceptions that are always allowed, even if they match a prohibited pattern */
    allowed: string[];
    /** File path globs to skip entirely */
    ignore: string[];
    /** File glob patterns to scan (used by CLI when no args are given) */
    patterns?: string[];
}
/** Built-in defaults matching the original hardcoded rules */
export declare const DEFAULT_CONFIG: LintConfig;
/**
 * Convert a config pattern like "p-{n}" or "bg-{color}-{shade}" into a RegExp
 * that matches actual Tailwind class values (the part after the prefix).
 *
 * Returns { prefix, valuePattern } where prefix is the utility prefix
 * and valuePattern is a RegExp for the value portion.
 */
export interface CompiledRule {
    prefix: string;
    valuePattern: RegExp;
    /** Reason template with {CLASS} as placeholder for the actual class name */
    reasonTemplate: string;
    /** True for numeric spacing rules — enables semantic token (hgap-/vgap-) allowance */
    isSpacingRule: boolean;
}
/**
 * Compile a single pattern string into a rule.
 */
export declare function compilePattern(pattern: string): CompiledRule;
/**
 * Compile an entire config into a set of rules ready for matching.
 */
export interface CompiledConfig {
    rules: CompiledRule[];
    allowed: Set<string>;
    ignore: string[];
}
export declare function compileConfig(config: LintConfig): CompiledConfig;
/**
 * Load config from the given directory, falling back to defaults.
 */
export declare function loadConfig(cwd: string): Promise<LintConfig>;
//# sourceMappingURL=config.d.ts.map