/**
 * Customer page scope — everything a customer page needs about WHO is asking,
 * resolved once per request.
 *
 * A customer page used to run its auth lookups one after another — session,
 * then eligibility, then company context — and repeat them when the layout,
 * the page and the server actions it awaits each asked again. This reads the
 * session once, runs the eligibility check and the company-context lookup in
 * parallel (both only need the session), and memoizes the result for the rest
 * of the request with React `cache`.
 *
 * Lives beside requireCustomer / eligibility / company context (rather than in
 * src/app/account) because it composes only those auth-layer pieces and is
 * equally useful to customer API routes and server actions. App-specific
 * narrowing (e.g. by a `?filter=` in the URL) belongs in the app, on top of the
 * returned `context`.
 *
 * Customer preview: the session comes from `requireCustomer`, whose
 * `getCustomerRequestSession` is the one hook point where the optional "View as
 * customer" overlay substitutes a synthesized customer session. Eligibility and
 * company context then run against it unchanged.
 */

import { cache } from "react";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { requireCustomer } from "./require-auth";
import {
  evaluateCustomerEligibility,
  type CustomerEligibility,
} from "./customer-eligibility";
import { resolveCompanyContext, type CompanyContext } from "./company-context";
import { isCompanyCustomer } from "../utils/auth-helpers";

export interface CustomerPageScope {
  session: Session;
  /** Company-Login (Keycloak / Mapp Cloud) customer — no local Account/User. */
  isCompanyCustomer: boolean;
  /** Always eligible for legacy (magic-link) customers. */
  eligibility: CustomerEligibility;
  /** The company context; null for legacy customers (they have no company). */
  context: CompanyContext | null;
}

export interface CustomerPageScopeOptions {
  /** Where to send an unauthenticated visitor (default `/auth/signin`). */
  redirectTo?: string;
  /**
   * The caller only reads — lets a READ-ONLY server action run during an admin
   * "View as customer" preview (see `RequireCustomerOptions.readOnly`).
   */
  readOnly?: boolean;
}

// Keyed on the redirect target and the read-only flag (primitives, so repeat
// calls hit the memo).
const loadCustomerPageScope = cache(
  async (redirectTo: string | undefined, readOnly: boolean): Promise<CustomerPageScope> => {
    const session = await requireCustomer({
      ...(redirectTo ? { redirectTo } : {}),
      ...(readOnly ? { readOnly } : {}),
    });
    const companyCustomer = isCompanyCustomer(session);
    // Both only need the session, so they run in parallel. The context is
    // scoped to the session's own account, so resolving it for a customer who
    // is then redirected as ineligible exposes nothing.
    const [eligibility, context] = await Promise.all([
      evaluateCustomerEligibility(session),
      companyCustomer ? resolveCompanyContext(session) : Promise.resolve(null),
    ]);
    return { session, isCompanyCustomer: companyCustomer, eligibility, context };
  },
);

/**
 * The authenticated customer's scope for this request (redirects to sign-in
 * when there is no customer session). Does NOT act on eligibility — use
 * `requireEligibleCustomerPageScope` for content pages.
 */
export function getCustomerPageScope(
  options: CustomerPageScopeOptions = {},
): Promise<CustomerPageScope> {
  return loadCustomerPageScope(options.redirectTo, options.readOnly === true);
}

/**
 * `getCustomerPageScope` for content pages: an ineligible customer is
 * redirected to the onboarding page with the reason.
 */
export async function requireEligibleCustomerPageScope(
  options: CustomerPageScopeOptions = {},
): Promise<CustomerPageScope> {
  const scope = await getCustomerPageScope(options);
  if (!scope.eligibility.eligible) {
    const { reason } = scope.eligibility;
    redirect(`/account/get-started${reason ? `?reason=${reason}` : ""}`);
  }
  return scope;
}
