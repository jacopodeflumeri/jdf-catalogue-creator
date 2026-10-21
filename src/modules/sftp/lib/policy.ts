/**
 * SFTP access policy (APP-SPECIFIC, pluggable).
 *
 * Follows the same seam convention as
 * `src/modules/auth/server/customer-eligibility.ts`: the template ships a
 * conservative default and an app replaces the exported policy with its own.
 *
 * The default is deliberately narrow — reads allowed, writes allowed but capped
 * and extension-limited to the data-interchange formats SFTP is normally used
 * for. An app that needs to move other file types states so explicitly, in one
 * reviewable place, rather than inheriting a wide-open transfer surface it never
 * chose.
 */

import { env } from '@/config/env';

export interface SftpPolicy {
  /** Whether callers may write (upload / mkdir) at all. */
  allowWrites: boolean;
  /**
   * Lowercase extensions (without the dot) accepted on upload. `null` means
   * "any extension" — set that only if you genuinely need it.
   */
  allowedUploadExtensions: string[] | null;
  /** Hard cap on a single transfer in either direction, in bytes. */
  maxFileBytes: number;
}

/**
 * Template default. Formats here are the ones SFTP file exchange actually
 * carries: delimited data, spreadsheets, archives, and their signatures.
 */
export const defaultSftpPolicy: SftpPolicy = {
  allowWrites: true,
  allowedUploadExtensions: [
    'csv',
    'tsv',
    'txt',
    'json',
    'jsonl',
    'ndjson',
    'xml',
    'xlsx',
    'xls',
    'parquet',
    'gz',
    'zip',
    'asc',
    'sig',
  ],
  maxFileBytes: env.SFTP_MAX_FILE_BYTES,
};

/**
 * The active policy. Reassign per app to widen or narrow the transfer surface.
 */
export const sftpPolicy: SftpPolicy = defaultSftpPolicy;

/**
 * Extract a lowercase extension, or null when the name has none.
 *
 * Requires a real basename before the dot, so a dotfile like `.bashrc` has no
 * extension rather than an extension of `bashrc` — otherwise a file named
 * `.csv` would pass an allowlist containing `csv`.
 */
export function fileExtension(filename: string): string | null {
  const match = /[^./]\.([a-z0-9]+)$/i.exec(filename);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Validate an upload against the active policy. Returns an error string, or
 * null when the upload is acceptable.
 *
 * Server-side on purpose: the previous module enforced size and extension only
 * in the upload component, so calling the action directly bypassed both.
 */
export function checkUpload(
  filename: string,
  byteLength: number,
  policy: SftpPolicy = sftpPolicy
): string | null {
  if (!policy.allowWrites) {
    return 'SFTP writes are disabled by policy.';
  }

  if (byteLength <= 0) {
    return 'File is empty.';
  }

  if (byteLength > policy.maxFileBytes) {
    return `File exceeds the ${Math.floor(policy.maxFileBytes / (1024 * 1024))}MB limit.`;
  }

  if (policy.allowedUploadExtensions) {
    const ext = fileExtension(filename);
    if (!ext || !policy.allowedUploadExtensions.includes(ext)) {
      return `File type not allowed. Permitted: ${policy.allowedUploadExtensions.join(', ')}.`;
    }
  }

  return null;
}
