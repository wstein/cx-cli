import os from 'node:os';
import { dirname, isAbsolute, resolve } from 'node:path';

/** Expand a leading tilde (`~`) in a file path to the user's home directory. */
export function expandTilde(pathname: string): string {
  if (pathname === '~') return os.homedir();
  if (pathname.startsWith('~/') || pathname.startsWith('~\\')) {
    return resolve(os.homedir(), pathname.slice(2));
  }
  return pathname;
}

/**
 * Resolve a path from the given base directory, supporting absolute paths, tilde
 * expansion, and paths relative to the base directory.
 */
export function resolveConfigPath(baseDir: string, targetPath: string): string {
  const expanded = expandTilde(targetPath);
  return isAbsolute(expanded) ? resolve(expanded) : resolve(baseDir, expanded);
}

/**
 * Resolve a configuration file path relative to the current working directory
 * or via tilde expansion.
 */
export function resolveConfigFilePath(cwd: string, configPath: string): string {
  const expanded = expandTilde(configPath);
  return isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
}

/**
 * Return the directory that contains the given config file path.
 */
export function configDirectory(configFilePath: string): string {
  return dirname(configFilePath);
}
