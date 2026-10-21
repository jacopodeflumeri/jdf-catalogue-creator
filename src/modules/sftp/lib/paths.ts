/**
 * SFTP path confinement — the single chokepoint for every remote path.
 *
 * ## The model
 *
 * Callers NEVER supply absolute remote paths. Every path entering this module
 * is interpreted as **relative to this app's SFTP root**, and is resolved to an
 * absolute path here and only here. A leading `/` means "the app root", not
 * "the filesystem root".
 *
 *     resolveSftpPath("reports/q3.csv")  ->  {root}/reports/q3.csv
 *     resolveSftpPath("/reports")        ->  {root}/reports
 *     resolveSftpPath("../other-app/x")  ->  throws SftpPathError
 *
 * The app root mirrors the per-app prefix isolation the `data_sync` capability
 * gets from S3 (`config/{envSlug}/{appSlug}/`, see
 * `infra/lib/constructs/data-sync-integration.ts`): every app built on this
 * template lands under its own `{SFTP_ROOT_PATH}/{appName}` subtree, so two
 * forks pointed at the same SFTP host don't overwrite each other's files.
 *
 * ## What this does NOT guarantee
 *
 * `data_sync`'s isolation is enforced by IAM — a buggy app *cannot* cross the
 * prefix boundary because AWS refuses the call. SFTP has no equivalent. The
 * service account can reach whatever the remote server granted it, so the
 * confinement below is enforced by THIS CODE ALONE. It is defense in depth, not
 * a boundary.
 *
 * **The real boundary is a chrooted SFTP account per app.** If you are wiring
 * this capability up, ask whoever operates the SFTP host to chroot the account
 * to the app's directory. See `docs/template/capabilities/SFTP.md`.
 */

import appConfig from '../../../../app.config.json';
import { env } from '@/config/env';

/** Thrown when a caller-supplied path would escape the app root. */
export class SftpPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SftpPathError';
  }
}

/**
 * Slugify the app name into something safe to use as a directory component.
 * `app.config.json` holds a human-editable value (`myapp` by default, but a
 * fork may have set anything), so it is never trusted verbatim.
 */
function appSlug(): string {
  const raw = String(appConfig.appName ?? '').trim();
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 64);

  if (!slug) {
    throw new SftpPathError(
      'SFTP: app.config.json "appName" is empty or unusable as a directory ' +
        'name. Set it (scripts/setup.sh) before enabling the SFTP capability.'
    );
  }

  return slug;
}

/** Normalize an absolute base path: posix separators, no trailing slash. */
function normalizeBase(input: string): string {
  if (input.includes('\0')) {
    throw new SftpPathError('SFTP: SFTP_ROOT_PATH contains a NUL byte.');
  }

  const segments: string[] = [];
  for (const segment of input.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return segments.length ? `/${segments.join('/')}` : '/';
}

/**
 * The absolute root this app is confined to.
 *
 * By default `{SFTP_ROOT_PATH}/{appSlug}`. Setting `SFTP_DISABLE_APP_PREFIX`
 * drops the app component — for counterparties that dictate their own directory
 * layout and cannot accommodate a per-app subdirectory. That is a deliberate
 * opt-out: without it you are relying entirely on a server-side chroot.
 */
export function getSftpAppRoot(): string {
  const base = normalizeBase(env.SFTP_ROOT_PATH || '/');

  if (env.SFTP_DISABLE_APP_PREFIX) {
    return base;
  }

  return base === '/' ? `/${appSlug()}` : `${base}/${appSlug()}`;
}

/**
 * Resolve a caller-supplied path to an absolute remote path inside the app root.
 *
 * Handles `.` and `..` by walking segments — deliberately NOT a regex, which is
 * how the previous implementation let `../` through untouched. Any attempt to
 * pop above the root throws rather than clamping, so traversal attempts surface
 * as errors instead of silently resolving somewhere unintended.
 */
export function resolveSftpPath(userPath: string = ''): string {
  if (typeof userPath !== 'string') {
    throw new SftpPathError('SFTP: path must be a string.');
  }

  if (userPath.includes('\0')) {
    throw new SftpPathError('SFTP: path contains a NUL byte.');
  }

  const root = getSftpAppRoot();
  const segments: string[] = [];

  for (const segment of userPath.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') continue;

    if (segment === '..') {
      if (segments.length === 0) {
        throw new SftpPathError(
          `SFTP: path "${userPath}" escapes the app root (${root}).`
        );
      }
      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  const resolved = segments.length ? `${root}/${segments.join('/')}` : root;

  // Belt and braces: the walk above should make this unreachable, but a bug
  // here is a full filesystem read, so assert the invariant rather than assume
  // it.
  if (resolved !== root && !resolved.startsWith(`${root}/`)) {
    throw new SftpPathError(
      `SFTP: resolved path "${resolved}" is outside the app root (${root}).`
    );
  }

  return resolved;
}

/**
 * Convert an absolute remote path back into the app-relative form that callers
 * and the UI use. Never leaks the absolute layout of the remote host.
 */
export function toDisplayPath(absolutePath: string): string {
  const root = getSftpAppRoot();

  if (absolutePath === root) return '/';
  if (absolutePath.startsWith(`${root}/`)) {
    return absolutePath.slice(root.length);
  }

  // Shouldn't happen — everything is resolved through resolveSftpPath — but
  // returning the raw absolute path here would defeat the point.
  throw new SftpPathError(
    `SFTP: cannot display path "${absolutePath}" outside the app root.`
  );
}

/** Join app-relative segments without resolving them against the root. */
export function joinRelative(...segments: string[]): string {
  return segments
    .filter(Boolean)
    .map((segment) => segment.replace(/\\/g, '/'))
    .join('/')
    .replace(/\/+/g, '/');
}
