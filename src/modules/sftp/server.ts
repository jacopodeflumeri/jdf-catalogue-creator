/**
 * SFTP server-only entry point.
 *
 * For app code that moves files itself — scheduled jobs, API routes, importers —
 * rather than driving the admin UI. These functions are NOT server actions:
 * they are not reachable from a browser and carry no auth gate of their own, so
 * whatever calls them owns the authorization decision.
 *
 * Paths are app-relative and confined exactly as they are for the actions.
 */

export {
  listDirectory,
  downloadFile,
  uploadFile,
  checkConnection,
  withSFTP,
  getSFTPConfig,
} from './lib/client';

export {
  getSftpAppRoot,
  resolveSftpPath,
  toDisplayPath,
  SftpPathError,
} from './lib/paths';

export {
  sftpPolicy,
  defaultSftpPolicy,
  checkUpload,
  fileExtension,
} from './lib/policy';

export type { SftpPolicy } from './lib/policy';
