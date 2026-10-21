/**
 * Company (Mapp Cloud) customer authentication — session hydration.
 *
 * Counterpart to `internal-admin-auth.ts`. Used for Keycloak "Company Login"
 * customers (non-Mapp). It:
 *   - upserts a `CompanyUser` record (the durable identity + lastLogin used for
 *     spend/usage attribution), keyed by mapp-cloud userId + integer companyId
 *   - resolves the local `Account` via the pluggable
 *     `resolveAccountIdForCompany(companyId)` seam (template default: none)
 *   - sets `role = 'customer'` and the company-context enrichment on the session
 *
 * It explicitly does NOT create a MappTeam admin record — customers must not
 * gain internal admin access.
 */

import logger from "@/lib/utils/logger";
import type {
  AuthUserExtended,
  IdentityProvider,
  WorkspaceAccess,
} from "@/modules/auth/types";
import { prismaService } from "@/lib/prisma/services";
import { parseEntityId } from "@/lib/utils/parse-id";
import { resolveAccountIdForCompany } from "./company-account-resolver";

export interface CompanyUserIdentityInput {
  email?: string;
  name?: string;
  loginName?: string;
  /** mapp-cloud user id (the `userId` claim, e.g. "19140"). */
  userId?: string;
  /** integer client-catalog company id, string-encoded (e.g. "5"). */
  companyId?: string;
  tenantId?: string;
  roles?: string[];
  workspaces?: WorkspaceAccess[];
  isMappEmployee?: boolean;
  mappLdapGroups?: string[];
  identityProvider: IdentityProvider;
  keycloakIdpHint?: string;
}

export async function hydrateCompanyUser(
  user: AuthUserExtended,
  identity: CompanyUserIdentityInput,
): Promise<boolean> {
  try {
    if (!identity.userId || !identity.companyId) {
      logger.error(
        "Company login is missing userId/companyId; cannot hydrate customer",
      );
      return false;
    }

    const companyIdInt = parseEntityId(identity.companyId);
    if (companyIdInt === null) {
      logger.error(
        "Company login companyId is not an integer:",
        identity.companyId,
      );
      return false;
    }

    // Resolve the local Account via the app's company→account seam (template
    // default: null). Re-resolved every login so a later onboarding links up.
    const accountId = await resolveAccountIdForCompany(companyIdInt);

    // Save/refresh the durable customer record (satisfies attribution needs).
    const row = await prismaService.companyUser.upsertOnLogin({
      mappUserId: identity.userId,
      companyId: companyIdInt,
      tenantId: identity.tenantId,
      loginName: identity.loginName,
      email: identity.email,
      name: identity.name,
      accountId,
    });

    user.role = "customer";
    user.name = identity.name ?? user.name;
    user.email = identity.email ?? user.email;

    // Link to the local account when the company is mapped; null otherwise.
    if (row.accountId != null) {
      user.accountId = String(row.accountId);
    } else {
      logger.warn(
        `Company login for companyId=${identity.companyId} has no mapped local Account (resolveAccountIdForCompany returned null)`,
      );
    }

    // --- Identity enrichment (mirrors the internal path) ---
    user.authSource = "keycloak";
    user.identityProvider = identity.identityProvider;
    user.loginName = identity.loginName;
    user.userId = identity.userId;
    user.companyId = identity.companyId;
    user.tenantId = identity.tenantId;
    user.roles = identity.roles;
    user.workspaces = identity.workspaces;
    user.isMappEmployee = identity.isMappEmployee;
    user.mappLdapGroups = identity.mappLdapGroups;
    user.keycloakIdpHint = identity.keycloakIdpHint;

    return true;
  } catch (error) {
    logger.error("Company user authentication error:", error);
    return false;
  }
}
