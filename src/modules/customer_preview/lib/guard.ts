/**
 * The read-only rule of "View as customer", as code.
 *
 * A preview session is a CUSTOMER session synthesized for an admin. Anything a
 * customer action writes while it is active would be recorded as the
 * customer's, done by someone who isn't them. So:
 *
 *   EVERY CUSTOMER MUTATION CALLS `assertNotPreview(session)` (or checks
 *   `isPreviewSession(session)` and returns its own error) BEFORE IT WRITES.
 *
 * That is the explicit layer. There is also a central one: `requireCustomer`
 * refuses a preview session in any server-action request unless the caller
 * passes `{ readOnly: true }` (see require-auth.ts). The central layer catches
 * a forgotten `assertNotPreview` in a server action; the explicit layer covers
 * everything else (route handlers, code called during render, jobs started
 * from a request) and gives the user a clear message.
 *
 * Pure and client-safe (type-only imports).
 */
import type { Session } from "next-auth";
import { CUSTOMER_PREVIEW_READ_ONLY_MESSAGE } from "./constants";

type SessionLike = Pick<Session, "user"> | null | undefined;

/** True when `session` is an admin's "View as customer" session. */
export function isPreviewSession(session: SessionLike): boolean {
  return Boolean(session?.user?.customerPreview);
}

/** Thrown when a customer mutation is attempted during a preview. */
export class CustomerPreviewReadOnlyError extends Error {
  readonly code = "CUSTOMER_PREVIEW_READ_ONLY";

  constructor(message: string = CUSTOMER_PREVIEW_READ_ONLY_MESSAGE) {
    super(message);
    this.name = "CustomerPreviewReadOnlyError";
  }
}

/**
 * Throw `CustomerPreviewReadOnlyError` when `session` is a preview session.
 * Call it at the top of every customer mutation, after `requireCustomer`.
 */
export function assertNotPreview(session: SessionLike): void {
  if (isPreviewSession(session)) {
    throw new CustomerPreviewReadOnlyError();
  }
}
