/** @jest-environment node */

import type { Session } from "next-auth";

const mockRequireCustomer = jest.fn();
jest.mock("../server/require-auth", () => ({
  requireCustomer: (...args: unknown[]) => mockRequireCustomer(...args),
}));

const mockEvaluate = jest.fn();
jest.mock("../server/customer-eligibility", () => ({
  evaluateCustomerEligibility: (...args: unknown[]) => mockEvaluate(...args),
}));

const mockResolveContext = jest.fn();
jest.mock("../server/company-context", () => ({
  resolveCompanyContext: (...args: unknown[]) => mockResolveContext(...args),
}));

const mockRedirect = jest.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
jest.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

import {
  getCustomerPageScope,
  requireEligibleCustomerPageScope,
} from "../server/customer-page-scope";

const companySession = {
  user: { role: "customer", authSource: "keycloak", accountId: "5", companyId: "19140" },
  expires: "2099-01-01T00:00:00.000Z",
} as unknown as Session;

const legacySession = {
  user: { role: "customer", authSource: "magic-link", accountId: "7" },
  expires: "2099-01-01T00:00:00.000Z",
} as unknown as Session;

const context = { accountId: 5, accountName: "Acme", companyId: "19140" };

beforeEach(() => {
  mockRequireCustomer.mockReset();
  mockEvaluate.mockReset();
  mockResolveContext.mockReset();
  mockRedirect.mockClear();
});

describe("getCustomerPageScope", () => {
  it("starts eligibility and company context together for a company customer", async () => {
    mockRequireCustomer.mockResolvedValue(companySession);
    let releaseEligibility: (v: unknown) => void = () => {};
    mockEvaluate.mockReturnValue(
      new Promise((resolve) => {
        releaseEligibility = resolve;
      }),
    );
    mockResolveContext.mockResolvedValue(context);

    const pending = getCustomerPageScope();
    // Let requireCustomer resolve; the context lookup must already have been
    // started while eligibility is still pending (parallel, not sequential).
    await new Promise((r) => setImmediate(r));
    expect(mockResolveContext).toHaveBeenCalledWith(companySession);
    releaseEligibility({ eligible: true, reason: null });

    await expect(pending).resolves.toEqual({
      session: companySession,
      isCompanyCustomer: true,
      eligibility: { eligible: true, reason: null },
      context,
    });
  });

  it("skips the company-context lookup for legacy customers", async () => {
    mockRequireCustomer.mockResolvedValue(legacySession);
    mockEvaluate.mockResolvedValue({ eligible: true, reason: null });

    const scope = await getCustomerPageScope();
    expect(scope.isCompanyCustomer).toBe(false);
    expect(scope.context).toBeNull();
    expect(mockResolveContext).not.toHaveBeenCalled();
  });

  it("passes a custom sign-in redirect through to requireCustomer", async () => {
    mockRequireCustomer.mockResolvedValue(legacySession);
    mockEvaluate.mockResolvedValue({ eligible: true, reason: null });

    await getCustomerPageScope({ redirectTo: "/auth/admin" });
    expect(mockRequireCustomer).toHaveBeenCalledWith({ redirectTo: "/auth/admin" });
  });
});

describe("requireEligibleCustomerPageScope", () => {
  it("redirects an ineligible customer to onboarding with the reason", async () => {
    mockRequireCustomer.mockResolvedValue(companySession);
    mockEvaluate.mockResolvedValue({ eligible: false, reason: "no-feed" });
    mockResolveContext.mockResolvedValue(context);

    await expect(requireEligibleCustomerPageScope()).rejects.toThrow(
      "REDIRECT:/account/get-started?reason=no-feed",
    );
  });

  it("returns the scope for an eligible customer", async () => {
    mockRequireCustomer.mockResolvedValue(companySession);
    mockEvaluate.mockResolvedValue({ eligible: true, reason: null });
    mockResolveContext.mockResolvedValue(context);

    const scope = await requireEligibleCustomerPageScope();
    expect(scope.context).toEqual(context);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
