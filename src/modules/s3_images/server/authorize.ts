/**
 * S3 authorization helpers — server-only.
 *
 * Turns "who is calling" into an `S3AccessLevel` and checks it against the
 * policy declared for a key's prefix in `../config/prefixes`.
 *
 * Both `/api/images/[...path]` and `/api/files/[...path]` go through here, so
 * they can no longer disagree about who may read a given prefix. Neither route
 * is covered by middleware (see `src/proxy.ts`), which is exactly why the
 * check has to be reliable at this layer.
 */

import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/modules/auth/config/nextauth';
import logger from '@/lib/utils/logger';
import {
  resolveS3Key,
  satisfiesAccessLevel,
  S3KeyError,
  type S3AccessLevel,
  type S3PrefixPolicy,
} from '../config/prefixes';

/** The caller's effective access level, derived from their session. */
export async function getCallerAccessLevel(): Promise<{
  level: S3AccessLevel;
  session: Session | null;
}> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { level: 'public', session: null };
  }

  return {
    level: session.user.role === 'admin' ? 'admin' : 'authenticated',
    session,
  };
}

export type S3AuthorizationResult =
  | { ok: true; key: string; policy: S3PrefixPolicy; session: Session | null }
  | { ok: false; status: 400 | 401 | 403; error: string };

/**
 * Authorize a read of `key`.
 *
 * Returns 401 rather than 403 for an anonymous caller hitting a protected
 * prefix, so the client knows signing in would help. A signed-in caller who
 * still lacks the level gets 403.
 */
export async function authorizeS3Read(
  key: string
): Promise<S3AuthorizationResult> {
  let resolved;

  try {
    resolved = resolveS3Key(key);
  } catch (error) {
    if (error instanceof S3KeyError) {
      logger.warn(`S3: rejected key "${key}": ${error.message}`);
      return { ok: false, status: 403, error: 'Invalid key' };
    }
    throw error;
  }

  const { level, session } = await getCallerAccessLevel();

  if (!satisfiesAccessLevel(level, resolved.policy.read)) {
    logger.warn(
      `S3: denied read of "${key}" (needs ${resolved.policy.read}, caller is ${level})`
    );
    return session
      ? { ok: false, status: 403, error: 'Forbidden' }
      : { ok: false, status: 401, error: 'Authentication required' };
  }

  return { ok: true, key: resolved.key, policy: resolved.policy, session };
}

/**
 * Authorize a write to a named prefix, given an already-established access
 * level. The upload routes have their own session handling, so this takes the
 * level rather than re-reading the session.
 */
export function authorizeS3Write(
  policy: S3PrefixPolicy,
  level: S3AccessLevel
): { ok: true } | { ok: false; status: 403; error: string } {
  if (!satisfiesAccessLevel(level, policy.write)) {
    logger.warn(
      `S3: denied write to "${policy.prefix}" (needs ${policy.write}, caller is ${level})`
    );
    return {
      ok: false,
      status: 403,
      error: `Uploading to "${policy.prefix}" requires ${policy.write} access.`,
    };
  }

  return { ok: true };
}
