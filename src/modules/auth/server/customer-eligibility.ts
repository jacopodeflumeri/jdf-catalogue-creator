/**
 * Customer eligibility gate (app-specific entitlement layer).
 *
 * This is the THIRD auth layer, distinct from identity (who you are) and
 * authorization (role/access): can this customer meaningfully use *this* app?
 *
 * It deliberately does NOT block login — an ineligible customer still gets a
 * session and is redirected to an onboarding page with a specific next step.
 *
 * The template ships a DEFAULT-ALLOW policy: every authenticated customer is
 * eligible. Apps override `customerEligibilityPolicy` with their own rule. For
 * example, FTL requires a FASHION customer with a UPC product feed and returns
 * a reason + CTA so the onboarding page can point the user at the right place.
 *
 * Only Company-Login (Keycloak / mapp-cloud) customers are gated here — legacy
 * magic-link customers bypass it so existing flows are untouched.
 */

import { cache } from "react";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import logger from "@/lib/utils/logger";
import { requireCustomer } from "./require-auth";
import type { RequireCustomerOptions } from "@/modules/auth/types";

export interface CustomerEligibility {
  eligible: boolean;
  /** Why they're ineligible (null when eligible). Drives the onboarding CTA. */
  reason?: string | null;
  /** Onboarding CTA target (app-specific). */
  ctaHref?: string;
  ctaLabel?: string;
}

/**
 * An app-pluggable policy: given a Company-Login customer session, decide
 * whether they may use the app, and (if not) why + where to send them.
 */
export interface CustomerEligibilityPolicy {
  evaluate(session: Session): Promise<CustomerEligibility> | CustomerEligibility;
}

/**
 * Template default: always eligible. Apps replace this with their own policy
 * (e.g. checking the workspace `services` entitlements from the `client_catalog`
 * capability, or a product feed from the `upc` capability).
 */
export const defaultCustomerEligibilityPolicy: CustomerEligibilityPolicy = {
  evaluate() {
    return { eligible: true, reason: null };
  },
};

/**
 * The active policy. Reassign (or swap this module's export) per app to install
 * an app-specific entitlement rule.
 */
export const customerEligibilityPolicy: CustomerEligibilityPolicy =
  defaultCustomerEligibilityPolicy;

/**
 * Evaluate whether a customer may use the app. Pure read — safe anywhere. The
 * gate applies only to Company-Login customers; others are always eligible.
 *
 * Memoized per request (React `cache`, keyed on the session object, which
 * `requireCustomer` resolves once per request): the layout, the page and any
 * server action it calls while rendering share one evaluation. A policy must
 * therefore be a pure read of the session + database — no side effects.
 */
export const evaluateCustomerEligibility = cache(async function evaluateCustomerEligibility(
  session: Session,
): Promise<CustomerEligibility> {
  if (session.user.authSource !== "keycloak") {
    return { eligible: true, reason: null };
  }

  const result = await customerEligibilityPolicy.evaluate(session);

  logger.debug("Customer eligibility evaluated", {
    companyId: session.user.companyId ?? null,
    eligible: result.eligible,
    reason: result.reason ?? null,
  });

  return result;
});

/**
 * Require an authenticated customer who is also eligible. Ineligible customers
 * are redirected to the onboarding page with the reason. Use this in place of
 * requireCustomer() on customer-facing content pages.
 */
export async function requireEligibleCustomer(
  options: RequireCustomerOptions = {},
): Promise<Session> {
  const session = await requireCustomer(options);
  const { eligible, reason } = await evaluateCustomerEligibility(session);
  if (!eligible) {
    redirect(`/account/get-started${reason ? `?reason=${reason}` : ""}`);
  }
  return session;
}
