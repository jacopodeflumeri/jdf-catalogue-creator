/**
 * S3 prefix policy — the single place an object's access level is decided.
 *
 * ## Why this exists
 *
 * Access control used to live inline in each route. `/api/files/[...path]`
 * required a session for `content/` and blocked executable extensions;
 * `/api/images/[...path]` served the *same prefix* with no session and no
 * content check. So the protections on one route were bypassable by requesting
 * the same key through the other, and every new route had to re-derive the
 * rules from scratch.
 *
 * Now each prefix declares its own read and write level once, here, and every
 * caller resolves through `resolveS3Key`.
 *
 * ## Adding a prefix
 *
 * Add it to `S3_PREFIXES` with explicit `read` and `write` levels. There is no
 * default: a key that matches no declared prefix is rejected.
 */

/**
 * Who may read or write objects under a prefix.
 *
 * - `public`  — no session required. Assume anything here is world-readable.
 * - `authenticated` — any signed-in user (customer or admin).
 * - `admin` — admin session required.
 */
export type S3AccessLevel = 'public' | 'authenticated' | 'admin';

export interface S3PrefixPolicy {
  /** The literal key prefix, including its trailing slash. */
  prefix: string;
  read: S3AccessLevel;
  write: S3AccessLevel;
  /** What belongs here — shown in docs and error messages. */
  description: string;
}

/**
 * Declared prefixes.
 *
 * `content/` is **authenticated**, not public. It is the default upload
 * destination and accepts non-image files, so serving it publicly meant any
 * document uploaded through `/api/upload` was readable by an unauthenticated
 * caller holding the key. Genuinely public assets belong in `public/`, which is
 * admin-write precisely because publishing is a deliberate act.
 */
export const S3_PREFIXES = {
  public: {
    prefix: 'public/',
    read: 'public',
    write: 'admin',
    description:
      'Deliberately world-readable assets (logos, marketing images). Admin-write.',
  },
  content: {
    prefix: 'content/',
    read: 'authenticated',
    write: 'authenticated',
    description:
      'General uploads: images, documents, media. Readable by signed-in users only.',
  },
  mappTeam: {
    prefix: 'mapp-team/',
    read: 'authenticated',
    write: 'admin',
    description: 'Team member profile images. Admin-write.',
  },
  temp: {
    prefix: 'temp/',
    read: 'authenticated',
    write: 'authenticated',
    description: 'Short-lived scratch uploads.',
  },
  // `satisfies`, not a type annotation: an annotation would widen `keyof` to
  // `string` and S3PathName would stop being a union of the real names.
} satisfies Record<string, S3PrefixPolicy>;

/** Logical prefix names, as accepted by the upload routes' `path` field. */
export type S3PathName = keyof typeof S3_PREFIXES;

/** Thrown when a key is malformed or falls outside every declared prefix. */
export class S3KeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'S3KeyError';
  }
}

/**
 * Narrow an untrusted `path` form field to a declared prefix name.
 *
 * The upload routes previously cast this value (`path as 'content' | ...`)
 * without checking it. An unrecognised value made `S3_CONFIG.paths[path]`
 * `undefined`, so the object was written to a key literally beginning
 * `"undefined"` — unreachable afterwards, since it matches no prefix on read.
 */
export function parsePathName(value: unknown): S3PathName {
  if (typeof value === 'string' && Object.hasOwn(S3_PREFIXES, value)) {
    return value as S3PathName;
  }

  throw new S3KeyError(
    `Unknown upload path "${String(value)}". Expected one of: ${Object.keys(
      S3_PREFIXES
    ).join(', ')}.`
  );
}

/**
 * Validate an S3 key and return the policy governing it.
 *
 * S3 treats keys as opaque strings, so `..` is not a traversal in the way it is
 * on a filesystem — but URL construction and intermediate proxies do not all
 * agree on that, and a key containing `..` is never something this app writes.
 * Rejecting them keeps the prefix check meaning what it appears to mean.
 */
export function resolveS3Key(key: string): {
  key: string;
  policy: S3PrefixPolicy;
} {
  if (typeof key !== 'string' || key.length === 0) {
    throw new S3KeyError('S3 key is required.');
  }

  if (key.includes('\0')) {
    throw new S3KeyError('S3 key contains a NUL byte.');
  }

  if (key.startsWith('/')) {
    throw new S3KeyError('S3 key must not start with "/".');
  }

  // Reject dot segments outright rather than trying to resolve them: no key
  // this app writes contains one, so anything that does is malformed or hostile.
  if (key.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw new S3KeyError(`S3 key "${key}" contains a relative path segment.`);
  }

  if (key.includes('//')) {
    throw new S3KeyError(`S3 key "${key}" contains an empty path segment.`);
  }

  const policy = Object.values(S3_PREFIXES).find((candidate) =>
    key.startsWith(candidate.prefix)
  );

  if (!policy) {
    throw new S3KeyError(
      `S3 key "${key}" is outside every declared prefix (${Object.values(
        S3_PREFIXES
      )
        .map((p) => p.prefix)
        .join(', ')}).`
    );
  }

  // A key that is exactly the prefix addresses the folder, not an object.
  if (key === policy.prefix) {
    throw new S3KeyError(`S3 key "${key}" does not name an object.`);
  }

  return { key, policy };
}

/**
 * Does a caller at `actual` satisfy a requirement of `required`?
 *
 * Ordering is admin > authenticated > public.
 */
export function satisfiesAccessLevel(
  actual: S3AccessLevel,
  required: S3AccessLevel
): boolean {
  const rank: Record<S3AccessLevel, number> = {
    public: 0,
    authenticated: 1,
    admin: 2,
  };

  return rank[actual] >= rank[required];
}
