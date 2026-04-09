/**
 * cx-cli public API
 *
 * Exports the adapter API and configuration helper for use from
 * programmatic callers and cx.ts config files.
 */

export {
  scanBundleFolder,
  writeManifestAndSha,
  createZipFromBundleFolder,
  parseRepomixFile,
  cleanupBundleGeneratedFiles,
  type FileEntry,
  type BundleManifest,
  type RepomixEntry,
} from './adapters/repomixAdapter.js';

export { runBundle, type BundleOptions } from './commands/bundle.js';
export { runList, type ListOptions } from './commands/list.js';
export { runInit, type InitOptions, type InitResult } from './commands/init.js';
export {
  runCleanup,
  type CleanupOptions,
  type CleanupResult,
} from './commands/cleanup.js';

// ---------------------------------------------------------------------------
// Config helper
// ---------------------------------------------------------------------------

export interface CxConfig {
  bundle?: {
    /** Include dotfiles when scanning bundle folders. */
    includeHidden?: boolean;
    /** Glob patterns to exclude during bundle scanning. */
    exclude?: string[];
  };
}

/**
 * Helper for defining a typed cx configuration object.
 * Use this in cx.ts config files for editor autocompletion.
 *
 * @example
 * ```ts
 * import { defineConfig } from 'cx-cli';
 * export default defineConfig({ bundle: { includeHidden: false } });
 * ```
 */
export function defineConfig(config: CxConfig): CxConfig {
  return config;
}
