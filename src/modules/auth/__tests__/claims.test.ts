/** @jest-environment node */

/**
 * Tests for the pure Keycloak claim-extraction helpers. These drive login
 * routing + session enrichment, so the edge cases matter.
 */

import {
  asNonEmptyString,
  deriveIsMappEmployee,
  extractBooleanClaim,
  extractStringArrayClaim,
  extractWorkspaceClaims,
  hasCompanyContextClaims,
  resolveKeycloakIdentityProvider,
  resolveKeycloakIdpHint,
  resolveKeycloakProfileEmail,
} from "../config/keycloak/claims";

describe("extractStringArrayClaim", () => {
  it("keeps non-empty trimmed strings, drops the rest", () => {
    expect(extractStringArrayClaim(["a", " b ", "", 3, null])).toEqual([
      "a",
      "b",
    ]);
  });
  it("returns [] for non-arrays", () => {
    expect(extractStringArrayClaim(undefined)).toEqual([]);
    expect(extractStringArrayClaim("a")).toEqual([]);
  });
});

describe("extractWorkspaceClaims", () => {
  it("normalizes workspace entries (incl. numeric ids) and drops invalid ones", () => {
    expect(
      extractWorkspaceClaims([
        { workspaceId: 19, services: ["FASHION", ""] },
        { workspaceId: "", services: [] },
        { services: ["x"] },
        "nope",
      ]),
    ).toEqual([{ workspaceId: "19", services: ["FASHION"] }]);
  });
});

describe("extractBooleanClaim", () => {
  it("parses bools and bool-strings, else undefined", () => {
    expect(extractBooleanClaim(true)).toBe(true);
    expect(extractBooleanClaim("false")).toBe(false);
    expect(extractBooleanClaim("yes")).toBeUndefined();
    expect(extractBooleanClaim(undefined)).toBeUndefined();
  });
});

describe("resolveKeycloakProfileEmail", () => {
  it("prefers email, falls back to an @-containing preferred_username", () => {
    expect(resolveKeycloakProfileEmail({ email: "a@b.com" })).toBe("a@b.com");
    expect(
      resolveKeycloakProfileEmail({ preferred_username: "c@d.com" }),
    ).toBe("c@d.com");
    expect(
      resolveKeycloakProfileEmail({ preferred_username: "nodomain" }),
    ).toBeUndefined();
  });
});

describe("deriveIsMappEmployee", () => {
  it("true on explicit claim, LDAP groups, or @mapp.com", () => {
    expect(deriveIsMappEmployee(true, "x@external.com", [])).toBe(true);
    expect(deriveIsMappEmployee(undefined, "x@external.com", ["grp"])).toBe(true);
    expect(deriveIsMappEmployee(undefined, "x@mapp.com", [])).toBe(true);
  });
  it("an explicit false does NOT override LDAP/email (OR semantics)", () => {
    expect(deriveIsMappEmployee(false, "x@mapp.com", [])).toBe(true);
    expect(deriveIsMappEmployee(false, "x@external.com", [])).toBe(false);
  });
});

describe("resolveKeycloakIdentityProvider", () => {
  it("detects mapp-cloud / entra from the identity_provider claim", () => {
    expect(
      resolveKeycloakIdentityProvider({ identity_provider: "mapp-cloud-company" }),
    ).toBe("mapp-cloud");
    expect(
      resolveKeycloakIdentityProvider({ identity_provider: "mapp-entra-id" }),
    ).toBe("entra");
  });
  it("falls back to the resolved idp hint", () => {
    expect(resolveKeycloakIdentityProvider({}, "mapp-cloud-company")).toBe(
      "mapp-cloud",
    );
    expect(resolveKeycloakIdentityProvider({}, "mapp-entra-id")).toBe("entra");
  });
  it("defaults to 'internal' (the unknown bucket) when nothing matches", () => {
    expect(resolveKeycloakIdentityProvider({}, undefined)).toBe("internal");
  });
});

describe("resolveKeycloakIdpHint", () => {
  it("uses an explicit hint claim when present", () => {
    expect(
      resolveKeycloakIdpHint({ kc_idp_hint: "custom" }, "internal", "company"),
    ).toBe("custom");
  });
  it("uses the company hint when company-context claims exist", () => {
    expect(
      resolveKeycloakIdpHint({ companyId: "5" }, "internal-hint", "company-hint"),
    ).toBe("company-hint");
  });
  it("falls back to the configured internal hint otherwise", () => {
    expect(resolveKeycloakIdpHint({}, "internal-hint", "company-hint")).toBe(
      "internal-hint",
    );
  });
});

describe("hasCompanyContextClaims", () => {
  it("true when any company-context claim is present", () => {
    expect(hasCompanyContextClaims({ companyId: "5" })).toBe(true);
    expect(
      hasCompanyContextClaims({ workspaces: [{ workspaceId: "1" }] }),
    ).toBe(true);
  });
  it("false when none are present", () => {
    expect(hasCompanyContextClaims({ email: "x@mapp.com" })).toBe(false);
  });
});

describe("asNonEmptyString", () => {
  it("trims and rejects empties/non-strings", () => {
    expect(asNonEmptyString("  hi ")).toBe("hi");
    expect(asNonEmptyString("   ")).toBeUndefined();
    expect(asNonEmptyString(5)).toBeUndefined();
  });
});
