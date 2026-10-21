/**
 * SFTP display helpers — safe to import from client components.
 *
 * Path manipulation deliberately does NOT live here. It is in `lib/paths.ts`,
 * which is server-only and is the single place remote paths are resolved. This
 * file previously exported `normalizePath` / `joinPath` / `getParentPath`,
 * which looked like they sanitized input but did not resolve `..` — callers
 * reasonably assumed they were safe. Formatting only, from here on.
 */

/** Format a byte count for display. */
export function formatFileSize(bytes?: number): string {
  if (!bytes) return '-';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/** Format a timestamp for display. */
export function formatTimestamp(timestamp?: number): string {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString();
}

/** Last segment of a path, for display and download filenames. */
export function getFilename(path: string): string {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() || '';
}
