/**
 * SFTP Server Actions
 *
 * ## Every export in this file is a public POST endpoint
 *
 * `'use server'` turns each exported function into a callable endpoint with a
 * generated action id. It does not matter whether a component references it,
 * whether the module's `index.ts` re-exports it, or whether any UI exists —
 * if it is exported here, an unauthenticated caller can invoke it, and
 * middleware does not cover it.
 *
 * So: **every export below starts with an auth guard, with no exceptions.** An
 * unguarded helper belongs in `lib/client.ts` (not a `'use server'` module),
 * not here. A previous version of this file had an unguarded
 * `downloadSFTPFileForCustomer` export that returned any file the service
 * account could read; see the 2026-08-22 entry in MIGRATION.md.
 *
 * Paths are app-relative throughout — see `lib/paths.ts`.
 */

'use server';

import { getAdminSession } from '@/modules/auth/server';
import { logger } from '@/lib/utils/logger';
import {
  listDirectory,
  downloadFile,
  uploadFile,
  checkConnection,
} from './client';
import { getSftpAppRoot, SftpPathError } from './paths';
import { checkUpload, sftpPolicy } from './policy';
import { env } from '@/config/env';
import type {
  SFTPDirectoryListing,
  SFTPDownloadData,
  SFTPOperationResult,
  SFTPUploadData,
  SFTPUploadRequest,
} from '../types';

/**
 * Editor-level admin gate for SFTP actions.
 *
 * Uses `getAdminSession` rather than `requireAdmin`: `requireAdmin` calls
 * `redirect()`, which throws NEXT_REDIRECT inside an action. That does deny
 * access, but it surfaces to the caller as a redirect rather than a refusal.
 * Returning null lets us answer with a clean failure envelope.
 */
async function guard<T = unknown>(): Promise<SFTPOperationResult<T> | null> {
  const session = await getAdminSession({ requireEditorAccess: true });

  if (!session) {
    logger.warn('SFTP: rejected unauthorized server action call');
    return {
      success: false,
      message: 'Not authorized',
      error: 'FORBIDDEN',
    };
  }

  return null;
}

/**
 * Convert a thrown error into a client-safe envelope.
 *
 * Path errors are returned as-is (they describe the caller's own input in
 * app-relative terms). Everything else is logged server-side and reported
 * generically, so remote absolute paths, hostnames, and ssh2 internals don't
 * leak to the browser.
 */
function toFailure<T = unknown>(
  context: string,
  error: unknown
): SFTPOperationResult<T> {
  if (error instanceof SftpPathError) {
    return { success: false, message: 'Invalid path', error: error.message };
  }

  logger.error(`SFTP: ${context} failed:`, error);
  return {
    success: false,
    message: `Failed to ${context}`,
    error: 'SFTP_ERROR',
  };
}

/**
 * Describe the app's SFTP area — for admin diagnostics and for showing users
 * which directory they are confined to.
 */
export async function getSFTPAreaInfo(): Promise<
  SFTPOperationResult<{ root: string; appPrefixEnabled: boolean }>
> {
  const denied = await guard<{ root: string; appPrefixEnabled: boolean }>();
  if (denied) return denied;

  try {
    return {
      success: true,
      message: 'OK',
      data: {
        root: getSftpAppRoot(),
        appPrefixEnabled: !env.SFTP_DISABLE_APP_PREFIX,
      },
    };
  } catch (error) {
    return toFailure('read SFTP configuration', error);
  }
}

/** List a directory inside the app's SFTP area. */
export async function listSFTPDirectory(
  path: string = '/'
): Promise<SFTPOperationResult<SFTPDirectoryListing>> {
  const denied = await guard<SFTPDirectoryListing>();
  if (denied) return denied;

  try {
    const listing = await listDirectory(path);
    return { success: true, message: 'OK', data: listing };
  } catch (error) {
    return toFailure('list directory', error);
  }
}

/** Download a file, base64-encoded for transport to the browser. */
export async function downloadSFTPFile(
  path: string
): Promise<SFTPOperationResult<SFTPDownloadData>> {
  const denied = await guard<SFTPDownloadData>();
  if (denied) return denied;

  try {
    const buffer = await downloadFile(path);
    const filename = path.split('/').filter(Boolean).pop() || 'download';

    logger.info(`SFTP: downloaded ${path} (${buffer.length} bytes)`);

    return {
      success: true,
      message: `File "${filename}" downloaded successfully`,
      data: {
        filename,
        content: buffer.toString('base64'),
        size: buffer.length,
      },
    };
  } catch (error) {
    return toFailure('download file', error);
  }
}

/** Upload a file into the app's SFTP area. */
export async function uploadSFTPFile(
  request: SFTPUploadRequest
): Promise<SFTPOperationResult<SFTPUploadData>> {
  const denied = await guard<SFTPUploadData>();
  if (denied) return denied;

  try {
    const { directory, filename, fileDataBase64 } = request;

    if (!filename || typeof filename !== 'string') {
      return {
        success: false,
        message: 'Invalid upload',
        error: 'A filename is required.',
      };
    }

    const buffer = Buffer.from(fileDataBase64, 'base64');

    // Server-side on purpose: the component-level checks are a UX affordance
    // and are absent when the action is called directly.
    const rejection = checkUpload(filename, buffer.length);
    if (rejection) {
      return { success: false, message: 'Upload rejected', error: rejection };
    }

    const written = await uploadFile(buffer, directory, filename);

    logger.info(`SFTP: uploaded ${written} (${buffer.length} bytes)`);

    return {
      success: true,
      message: `File "${filename}" uploaded successfully`,
      data: { path: written, filename, size: buffer.length },
    };
  } catch (error) {
    return toFailure('upload file', error);
  }
}

/** Verify connectivity and that the app's root is reachable. */
export async function checkSFTPConnection(): Promise<SFTPOperationResult> {
  const denied = await guard();
  if (denied) return denied;

  try {
    await checkConnection();
    return { success: true, message: 'SFTP connection successful' };
  } catch (error) {
    return toFailure('connect to SFTP', error);
  }
}

/** The active transfer policy, for UI affordances (limits, allowed types). */
export async function getSFTPPolicy(): Promise<
  SFTPOperationResult<{
    allowWrites: boolean;
    allowedUploadExtensions: string[] | null;
    maxFileBytes: number;
  }>
> {
  const denied = await guard<{
    allowWrites: boolean;
    allowedUploadExtensions: string[] | null;
    maxFileBytes: number;
  }>();
  if (denied) return denied;

  return {
    success: true,
    message: 'OK',
    data: {
      allowWrites: sftpPolicy.allowWrites,
      allowedUploadExtensions: sftpPolicy.allowedUploadExtensions,
      maxFileBytes: sftpPolicy.maxFileBytes,
    },
  };
}
