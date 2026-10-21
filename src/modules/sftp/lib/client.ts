/**
 * SFTP client.
 *
 * The only module that touches `ssh2-sftp-client`. Every function here takes
 * **app-relative** paths and resolves them through `resolveSftpPath` itself, so
 * there is no code path that reaches the remote server with a caller-supplied
 * path that has not been confined to the app root.
 */

import { createHash } from 'crypto';
import SFTPClient from 'ssh2-sftp-client';
import { env } from '@/config/env';
import { logger } from '@/lib/utils/logger';
import { resolveSftpPath, toDisplayPath, joinRelative } from './paths';
import { sftpPolicy } from './policy';
import type {
  SFTPConnectionConfig,
  SFTPItem,
  SFTPDirectoryListing,
} from '../types';

/**
 * Build the connection config, validating that we have both a credential and a
 * host key policy before we try to use them.
 */
export function getSFTPConfig(): SFTPConnectionConfig {
  if (!env.SFTP_HOST || !env.SFTP_USERNAME) {
    throw new Error(
      'SFTP configuration is incomplete: SFTP_HOST and SFTP_USERNAME are required.'
    );
  }

  if (!env.SFTP_PASSWORD && !env.SFTP_PRIVATE_KEY) {
    throw new Error(
      'SFTP requires either SFTP_PASSWORD or SFTP_PRIVATE_KEY.'
    );
  }

  if (!env.SFTP_HOST_FINGERPRINT && !env.SFTP_ALLOW_UNKNOWN_HOST_KEY) {
    throw new Error(
      'SFTP_HOST_FINGERPRINT is not set. Without it the client would accept ' +
        'any host key, which lets an attacker on the network path impersonate ' +
        'the server and capture the service account credential. Get it with:\n' +
        `  ssh-keyscan -t ed25519 ${env.SFTP_HOST} | ssh-keygen -lf -\n` +
        'For local development against a throwaway server only, set ' +
        'SFTP_ALLOW_UNKNOWN_HOST_KEY=true.'
    );
  }

  if (env.SFTP_ALLOW_UNKNOWN_HOST_KEY && env.NODE_ENV === 'production') {
    throw new Error(
      'SFTP_ALLOW_UNKNOWN_HOST_KEY must not be set in production.'
    );
  }

  return {
    host: env.SFTP_HOST,
    port: env.SFTP_PORT || 22,
    username: env.SFTP_USERNAME,
    password: env.SFTP_PASSWORD,
    privateKey: env.SFTP_PRIVATE_KEY,
    passphrase: env.SFTP_PASSPHRASE,
    hostFingerprint: env.SFTP_HOST_FINGERPRINT,
    readyTimeout: 20000,
  };
}

/** SHA-256 host key fingerprint in the `SHA256:<base64>` form ssh-keygen prints. */
function fingerprint(key: Buffer): string {
  return `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`;
}

/**
 * Verify the server's host key against the pinned fingerprint. Accepts the
 * fingerprint with or without the `SHA256:` prefix, since both forms get pasted
 * out of terminals.
 */
function makeHostVerifier(expected?: string) {
  if (!expected) {
    // Only reachable when SFTP_ALLOW_UNKNOWN_HOST_KEY is set (getSFTPConfig
    // refuses otherwise, and refuses it outright in production).
    return undefined;
  }

  const want = expected.startsWith('SHA256:') ? expected : `SHA256:${expected}`;
  const normalizedWant = want.replace(/=+$/, '');

  return (key: Buffer): boolean => {
    const got = fingerprint(key);
    if (got === normalizedWant) return true;

    logger.error(
      `SFTP host key mismatch for ${env.SFTP_HOST}: expected ${normalizedWant}, got ${got}`
    );
    return false;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connect(maxRetries: number = 3): Promise<SFTPClient> {
  const config = getSFTPConfig();
  const hostVerifier = makeHostVerifier(config.hostFingerprint);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const client = new SFTPClient();

    try {
      await client.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        privateKey: config.privateKey,
        passphrase: config.passphrase,
        readyTimeout: config.readyTimeout,
        retries: 1,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3,
        ...(hostVerifier ? { hostVerifier } : {}),
        algorithms: {
          kex: [
            'curve25519-sha256',
            'curve25519-sha256@libssh.org',
            'ecdh-sha2-nistp256',
            'ecdh-sha2-nistp384',
            'ecdh-sha2-nistp521',
            'diffie-hellman-group-exchange-sha256',
            'diffie-hellman-group14-sha256',
          ],
          cipher: [
            'aes128-ctr',
            'aes192-ctr',
            'aes256-ctr',
            'aes128-gcm',
            'aes128-gcm@openssh.com',
            'aes256-gcm',
            'aes256-gcm@openssh.com',
          ],
        },
      });

      return client;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error('Unknown connection error');

      try {
        await client.end();
      } catch {
        // Ignore cleanup errors on an already-failed connection.
      }

      // A rejected host key is not a transient fault — retrying just repeats
      // the handshake against a server we've decided not to trust.
      if (/host key|handshake/i.test(lastError.message)) {
        break;
      }

      if (attempt < maxRetries) {
        await sleep(Math.min(1000 * Math.pow(2, attempt - 1), 5000));
      }
    }
  }

  throw new Error(
    `SFTP connection failed: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Run `fn` against a connected client and always close the connection.
 *
 * Every operation opens its own connection. That is deliberate for a template:
 * a pooled long-lived connection is faster but needs liveness handling and
 * shared-state care that most apps here won't add. Revisit if an app moves
 * enough files for the handshake cost to matter.
 */
export async function withSFTP<T>(
  fn: (client: SFTPClient) => Promise<T>
): Promise<T> {
  const client = await connect();
  try {
    return await fn(client);
  } finally {
    try {
      await client.end();
    } catch (error) {
      logger.warn('Error closing SFTP connection:', error);
    }
  }
}

/** List a directory. `path` is app-relative. */
export async function listDirectory(
  path: string = '/'
): Promise<SFTPDirectoryListing> {
  const absolute = resolveSftpPath(path);
  const currentPath = toDisplayPath(absolute);

  const files = await withSFTP((client) => client.list(absolute));

  const items: SFTPItem[] = files.map((file) => ({
    name: file.name,
    path: joinRelative(currentPath, file.name),
    type: file.type === 'd' ? 'directory' : 'file',
    size: file.size,
    modifyTime: file.modifyTime,
    accessTime: file.accessTime,
  }));

  items.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'directory' ? -1 : 1;
  });

  // Parent stays inside the app area: the root has no parent to navigate to.
  const parentPath =
    currentPath === '/'
      ? null
      : `/${currentPath.split('/').filter(Boolean).slice(0, -1).join('/')}`;

  return { currentPath, items, parentPath };
}

/**
 * Download a file. `path` is app-relative.
 *
 * Stats first and refuses anything over the policy cap — the buffer is held in
 * memory and returned through a server action, so an unbounded file is an OOM
 * of the whole task.
 */
export async function downloadFile(path: string): Promise<Buffer> {
  const absolute = resolveSftpPath(path);

  return withSFTP(async (client) => {
    const stat = await client.stat(absolute);

    if (stat.isDirectory) {
      throw new Error('Path is a directory, not a file.');
    }

    if (stat.size > sftpPolicy.maxFileBytes) {
      throw new Error(
        `File is ${Math.round(stat.size / (1024 * 1024))}MB, over the ` +
          `${Math.floor(sftpPolicy.maxFileBytes / (1024 * 1024))}MB limit.`
      );
    }

    return (await client.get(absolute)) as Buffer;
  });
}

/**
 * Upload a buffer into an app-relative directory. Returns the app-relative path
 * of the written file.
 */
export async function uploadFile(
  buffer: Buffer,
  directory: string,
  filename: string
): Promise<string> {
  // Resolving the joined path (rather than the directory alone) means a
  // filename carrying `../` is caught here too.
  const relative = joinRelative(directory, filename);
  const absoluteDir = resolveSftpPath(directory);
  const absolute = resolveSftpPath(relative);

  await withSFTP(async (client) => {
    if (!(await client.exists(absoluteDir))) {
      await client.mkdir(absoluteDir, true);
    }
    await client.put(buffer, absolute);
  });

  return toDisplayPath(absolute);
}

/** Check connectivity by listing the app root. */
export async function checkConnection(): Promise<void> {
  await withSFTP((client) => client.list(resolveSftpPath('/')));
}
