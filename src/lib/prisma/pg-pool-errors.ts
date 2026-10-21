/**
 * Logging hooks for the Prisma pg adapter's pool.
 *
 * `@prisma/adapter-pg` already attaches an `error` listener to its pool, so a
 * dropped idle connection (RDS restart, failover) cannot crash the process —
 * but it only `debug()`-logs it, which is invisible in CloudWatch. These hooks
 * log it at error level (production runs LOG_LEVEL=error).
 *
 * Only the error's code, message and a short context are logged: never the
 * error object (or anything else that could carry the connection string or
 * credentials).
 */

import logger from "@/lib/utils/logger";

type PgError = Error & { code?: unknown };

// pg's own messages don't include credentials, but a message built from a
// connection string would: drop any `scheme://user:pass@` userinfo and the
// configured password, whatever produced the message.
function redact(text: string): string {
  let out = text.replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]*@/gi, "$1***@");
  const password = process.env.DB_PASSWORD;
  if (password && password.length >= 4) out = out.split(password).join("***");
  return out;
}

export function formatPgPoolError(context: string, err: unknown): string {
  const e = (err ?? {}) as PgError;
  const code = typeof e.code === "string" && e.code ? ` (${e.code})` : "";
  const message = typeof e.message === "string" ? e.message : String(err);
  return `[db] ${context}${code}: ${redact(message)}`;
}

function logPgError(context: string, err: unknown): void {
  try {
    logger.error(formatPgPoolError(context, err));
  } catch {
    // A logging failure must never turn a recoverable pool error into a crash.
  }
}

/** An idle pooled client's connection died; pg-pool discards it and the next query reconnects. */
export function onPoolError(err: Error): void {
  logPgError("idle pool client dropped", err);
}

/** A checked-out connection (held by an interactive transaction) errored. */
export function onConnectionError(err: Error): void {
  logPgError("transaction connection error", err);
}

export const pgAdapterErrorHooks = { onPoolError, onConnectionError };
