/**
 * Keycloak claim-extraction helpers.
 *
 * Pure functions (no config / no I/O) that normalize the loosely-typed OIDC
 * `profile` claims into the shapes the auth callbacks need. Kept separate from
 * `nextauth.ts` so they are unit-testable and reusable across Labs apps.
 */

export function extractStringArrayClaim(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

export function extractWorkspaceClaims(
  value: unknown,
): { workspaceId: string; services: string[] }[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const workspaceId = extractScalarStringClaim(
        (entry as Record<string, unknown>).workspaceId,
      );
      if (!workspaceId) {
        return null;
      }

      return {
        workspaceId,
        services: extractStringArrayClaim(
          (entry as Record<string, unknown>).services,
        ),
      };
    })
    .filter(
      (entry): entry is { workspaceId: string; services: string[] } =>
        entry !== null,
    );
}

export function extractScalarStringClaim(value: unknown): string | undefined {
  if (typeof value === "string") {
    return asNonEmptyString(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

export function extractBooleanClaim(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
  }

  return undefined;
}

export function resolveKeycloakProfileEmail(
  profile: Record<string, unknown> | undefined,
): string | undefined {
  const email = asNonEmptyString(profile?.email);
  if (email) {
    return email;
  }

  const preferredUsername = asNonEmptyString(profile?.preferred_username);
  if (preferredUsername?.includes("@")) {
    return preferredUsername;
  }

  return undefined;
}

export function resolveKeycloakProfileName(
  profile: Record<string, unknown> | undefined,
): string | undefined {
  return (
    asNonEmptyString(profile?.name) ??
    asNonEmptyString(profile?.preferred_username) ??
    resolveKeycloakProfileEmail(profile)
  );
}

export function resolveKeycloakProfileId(
  profile: Record<string, unknown> | undefined,
): string {
  return (
    asNonEmptyString(profile?.sub) ??
    resolveKeycloakProfileEmail(profile) ??
    "keycloak-user"
  );
}

export function resolveKeycloakIdpHint(
  profile: Record<string, unknown> | undefined,
  configuredInternalIdpHint?: string,
  configuredCompanyIdpHint?: string,
): string | undefined {
  const explicitHint =
    asNonEmptyString(profile?.kc_idp_hint) ??
    asNonEmptyString(profile?.keycloakIdpHint) ??
    asNonEmptyString(profile?.idp_hint);

  if (explicitHint) {
    return explicitHint;
  }

  if (hasCompanyContextClaims(profile)) {
    return configuredCompanyIdpHint || "mapp-cloud-company";
  }

  return configuredInternalIdpHint;
}

export function resolveKeycloakIdentityProvider(
  profile: Record<string, unknown> | undefined,
  resolvedIdpHint?: string,
): "entra" | "internal" | "mapp-cloud" {
  const provider =
    asNonEmptyString(profile?.identity_provider) ??
    asNonEmptyString(profile?.identityProvider) ??
    asNonEmptyString(profile?.idp);

  const normalized = provider?.toLowerCase();
  if (normalized?.includes("mapp-cloud")) {
    return "mapp-cloud";
  }
  if (normalized?.includes("entra") || normalized?.includes("azure")) {
    return "entra";
  }

  const normalizedHint = resolvedIdpHint?.trim().toLowerCase();
  if (normalizedHint?.includes("mapp-cloud")) {
    return "mapp-cloud";
  }
  if (normalizedHint?.includes("entra") || normalizedHint?.includes("azure")) {
    return "entra";
  }

  return "internal";
}

export function hasCompanyContextClaims(
  profile: Record<string, unknown> | undefined,
): boolean {
  return Boolean(
    asNonEmptyString(profile?.loginName) ||
      asNonEmptyString(profile?.companyId) ||
      asNonEmptyString(profile?.userId) ||
      asNonEmptyString(profile?.tenantId) ||
      extractWorkspaceClaims(profile?.workspaces).length > 0,
  );
}

export function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Derive whether a Keycloak identity is a Mapp employee. Single source of truth
 * for the rule so the `profile()` and `signIn()` callbacks can't drift apart:
 * an explicit claim OR non-empty LDAP groups OR an @mapp.com email. Pass the
 * already-resolved claim value (profile() passes the raw claim; signIn() passes
 * `user.isMappEmployee ?? <raw claim>`).
 */
export function deriveIsMappEmployee(
  explicitClaim: boolean | undefined,
  email: string | undefined,
  mappLdapGroups: string[],
): boolean {
  return (
    (explicitClaim ?? false) ||
    mappLdapGroups.length > 0 ||
    (email?.toLowerCase().endsWith("@mapp.com") ?? false)
  );
}
