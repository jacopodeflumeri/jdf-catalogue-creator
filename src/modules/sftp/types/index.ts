/**
 * SFTP Module Types
 *
 * Note on paths: every `path` in this module is **app-relative** — relative to
 * `{SFTP_ROOT_PATH}/{appName}`. A leading `/` means the app root, not the
 * filesystem root. Absolute remote paths exist only inside `lib/client.ts`.
 */

/** A file or directory inside the app's SFTP area. */
export interface SFTPItem {
  /** File or directory name. */
  name: string;
  /** App-relative path. */
  path: string;
  type: 'file' | 'directory';
  /** File size in bytes (files only). */
  size?: number;
  modifyTime?: number;
  accessTime?: number;
}

/** Directory listing result. */
export interface SFTPDirectoryListing {
  /** App-relative path of the listed directory. */
  currentPath: string;
  items: SFTPItem[];
  /** App-relative parent path; null at the app root. */
  parentPath: string | null;
}

/** File upload request. */
export interface SFTPUploadRequest {
  /** App-relative destination directory. */
  directory: string;
  /** Filename to write. Traversal in this value is rejected. */
  filename: string;
  /** File contents, base64-encoded. */
  fileDataBase64: string;
}

/** Result envelope returned by the server actions. */
export interface SFTPOperationResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

/** Payload of a successful download. */
export interface SFTPDownloadData {
  filename: string;
  /** File contents, base64-encoded. */
  content: string;
  size: number;
}

/** Payload of a successful upload. */
export interface SFTPUploadData {
  /** App-relative path of the written file. */
  path: string;
  filename: string;
  size: number;
}

/** SFTP connection configuration. */
export interface SFTPConnectionConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  /** Pinned SHA-256 host key fingerprint (`SHA256:...`). */
  hostFingerprint?: string;
  readyTimeout?: number;
}

/** Breadcrumb navigation item. */
export interface BreadcrumbItem {
  label: string;
  path: string;
}

/** File action callback type. */
export type FileActionCallback = (file: SFTPItem) => void | Promise<void>;

/**
 * Upload UI configuration.
 *
 * These are **cosmetic affordances only** — they shape the file picker and the
 * inline hints. The limits that actually hold are in `lib/policy.ts` and are
 * enforced server-side in `uploadSFTPFile`, because anything checked here is
 * absent when the action is called directly.
 */
export interface UploadConfig {
  /** Allow the user to rename the file before upload. */
  allowCustomFilename?: boolean;
  /** Prefix prefilled into the filename field. */
  filenamePrefix?: string;
  /** Extensions to hint in the picker, e.g. ['.csv', '.json']. */
  allowedExtensions?: string[];
  /** Size hint in bytes. */
  maxFileSize?: number;
}
