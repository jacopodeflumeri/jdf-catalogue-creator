/**
 * SFTP Module
 *
 * File exchange with a single external SFTP endpoint, confined to a per-app
 * directory. See `docs/template/capabilities/SFTP.md` before wiring this up — in
 * particular the section on what the confinement does and does not guarantee.
 *
 * All paths in this module's public API are **app-relative**: `/` means this
 * app's SFTP area, never the remote filesystem root.
 */

// Components
export { default as SFTPBrowser } from './components/SFTPBrowser';
export { default as SFTPFileUpload } from './components/SFTPFileUpload';

// Server Actions — every one is admin-gated (editor level).
export {
  listSFTPDirectory,
  downloadSFTPFile,
  uploadSFTPFile,
  checkSFTPConnection,
  getSFTPAreaInfo,
  getSFTPPolicy,
} from './lib/actions';

// Display helpers (safe in client components)
export { formatFileSize, formatTimestamp, getFilename } from './lib/utils';

// Types
export type {
  SFTPItem,
  SFTPDirectoryListing,
  SFTPUploadRequest,
  SFTPOperationResult,
  SFTPDownloadData,
  SFTPUploadData,
  SFTPConnectionConfig,
  BreadcrumbItem,
  FileActionCallback,
  UploadConfig,
} from './types';
