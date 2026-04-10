/**
 * Design token lint rules.
 *
 * Checks Tailwind class names against compiled config patterns.
 * Falls back to built-in defaults when no config file is present.
 */
import { type CompiledConfig } from './config.js';
export interface Violation {
    className: string;
    reason: string;
}
/**
 * Set the active lint config. Call this after loading a config file.
 */
export declare function setConfig(config: CompiledConfig): void;
/**
 * Get the currently active compiled config.
 */
export declare function getConfig(): CompiledConfig;
/**
 * Check a single Tailwind class name for design token violations.
 * Returns a Violation if the class is prohibited, or null if it's fine.
 */
export declare function checkClass(className: string): Violation | null;
/**
 * Check a class against a specific compiled config (for testing).
 */
export declare function checkClassWithConfig(className: string, config: CompiledConfig): Violation | null;
//# sourceMappingURL=rules.d.ts.map