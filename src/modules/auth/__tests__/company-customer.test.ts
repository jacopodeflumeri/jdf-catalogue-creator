/** @jest-environment node */

/**
 * Tests for the Company-Login (Keycloak / Mapp Cloud) customer helpers:
 *   - isCompanyCustomer        (role=customer && authSource=keycloak)
 *   - evaluateCustomerEligibility (template default-allow policy)
 *   - resolveUsageAttribution  (admin vs company-customer attribution keys)
 */

jest.mock("@/lib/utils/logger", () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  },
}));

// usage-attribution + customer-eligibility pull in prismaService; stub it so no
// real Prisma client is constructed. require-auth is mocked so customer-
// eligibility's top-level import doesn't drag in the full nextauth chain.
const mockGetByMappUserAndCompany = jest.fn();
jest.mock("@/lib/prisma/services", () => ({
  prismaService: {
    companyUser: {
      getByMappUserAndCompany: (...args: any[]) =>
        mockGetByMappUserAndCompany(...args),
    },
  },
}));
jest.mock("../server/require-auth", () => ({
  requireCustomer: jest.fn(),
}));

import type { Session } from "next-auth";
import { isCompanyCustomer } from "../utils/auth-helpers";
import { evaluateCustomerEligibility } from "../server/customer-eligibility";
import { resolveUsageAttribution } from "../server/usage-attribution";

function session(user: Record<string, unknown>): Session {
  return { user, expires: "" } as unknown as Session;
}

describe("isCompanyCustomer", () => {
  it("true only for a keycloak customer", () => {
    expect(
      isCompanyCustomer(session({ role: "customer", authSource: "keycloak" })),
    ).toBe(true);
  });
  it("false for magic-link customers and admins", () => {
    expect(
      isCompanyCustomer(session({ role: "customer", authSource: "magic-link" })),
    ).toBe(false);
    expect(
      isCompanyCustomer(session({ role: "admin", authSource: "keycloak" })),
    ).toBe(false);
  });
});

describe("evaluateCustomerEligibility (default-allow)", () => {
  it("non-keycloak customers are always eligible", async () => {
    const result = await evaluateCustomerEligibility(
      session({ role: "customer", authSource: "magic-link" }),
    );
    expect(result.eligible).toBe(true);
  });
  it("keycloak customers are eligible under the template default policy", async () => {
    const result = await evaluateCustomerEligibility(
      session({ role: "customer", authSource: "keycloak", companyId: "5" }),
    );
    expect(result.eligible).toBe(true);
  });
});

describe("resolveUsageAttribution", () => {
  beforeEach(() => mockGetByMappUserAndCompany.mockReset());

  it("attributes an admin's 'View as customer' session to the ADMIN, never the company", async () => {
    const result = await resolveUsageAttribution(
      session({
        role: "customer",
        authSource: "keycloak",
        companyId: "5046",
        userId: "should-not-be-used",
        customerPreview: { adminMappUserId: 42, companyId: 5046 },
      }),
      { workspaceId: 9 },
    );
    expect(result).toEqual({ userId: 42, companyUserId: null, companyId: null, workspaceId: 9 });
    expect(mockGetByMappUserAndCompany).not.toHaveBeenCalled();
  });

  it("attributes an admin to userId only", async () => {
    const result = await resolveUsageAttribution(
      session({ role: "admin", adminId: "42" }),
    );
    expect(result).toEqual({
      userId: 42,
      companyUserId: null,
      companyId: null,
      workspaceId: null,
    });
  });

  it("attributes a company customer to companyUserId + companyId", async () => {
    mockGetByMappUserAndCompany.mockResolvedValue({ id: 7 });
    const result = await resolveUsageAttribution(
      session({
        role: "customer",
        authSource: "keycloak",
        userId: "19140",
        companyId: "5",
      }),
      { workspaceId: 19 },
    );
    expect(result).toEqual({
      userId: null,
      companyUserId: 7,
      companyId: 5,
      workspaceId: 19,
    });
    expect(mockGetByMappUserAndCompany).toHaveBeenCalledWith("19140", 5);
  });
});
