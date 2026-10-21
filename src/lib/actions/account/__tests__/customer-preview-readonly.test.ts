/** @jest-environment node */

/**
 * The read-only rule of "View as customer", pinned on every customer mutation
 * the template ships: with a preview session, none of them writes anything.
 * (New customer mutations must call `assertNotPreview` too — see
 * docs/template/capabilities/CUSTOMER_PREVIEW.md.)
 */

const previewSession = {
  user: {
    id: "7",
    email: "ada@mapp.com",
    role: "customer",
    authSource: "keycloak",
    accountId: "42",
    companyId: "5046",
    customerPreview: {
      adminEmail: "ada@mapp.com",
      adminMappUserId: 7,
      companyId: 5046,
      companyName: "Acme",
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
  },
  expires: "2099-01-01T00:00:00.000Z",
};

const mockRequireCustomer = jest.fn(async () => previewSession);
jest.mock("@/modules/auth/server", () => ({
  requireCustomer: () => mockRequireCustomer(),
  requireCustomerForAccountSelection: jest.fn(),
  generateAccountEmail: jest.fn(() => "account-42@example.com"),
}));
jest.mock("@/modules/auth/server/require-auth", () => ({
  requireCustomer: () => mockRequireCustomer(),
  requireAdmin: jest.fn(),
}));

// Every write the actions could reach. None may be called.
const writes = {
  updateContact: jest.fn(),
  createContact: jest.fn(),
  generateMagicLinkUrl: jest.fn(),
  createActivity: jest.fn(),
};
const reads = {
  getAccountById: jest.fn(async () => ({
    id: 42,
    accountUsers: [{ id: 1, user: { email: "ada@mapp.com" }, access: "customer" }],
  })),
  getUserById: jest.fn(async () => ({ id: 3, email: "u@example.com" })),
};
jest.mock("@/lib/prisma/services", () => ({
  prismaService: {
    account: { getAccountById: (...a: unknown[]) => reads.getAccountById(...(a as [])) },
    accountUser: {
      updateContact: (...a: unknown[]) => writes.updateContact(...a),
      createContact: (...a: unknown[]) => writes.createContact(...a),
    },
    user: { getUserById: (...a: unknown[]) => reads.getUserById(...(a as [])) },
    auth: { generateMagicLinkUrl: (...a: unknown[]) => writes.generateMagicLinkUrl(...a) },
    accountActivity: { createActivity: (...a: unknown[]) => writes.createActivity(...a) },
  },
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/utils/logger", () => ({
  __esModule: true,
  default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn() },
}));

import {
  generateCustomerAccountMagicLink,
  generateCustomerUserMagicLink,
  inviteTeamMember,
  updateUserNames,
} from "../account-actions";
import { updateCustomerProfileRequest } from "../account-profile-actions";
import { accountActivity, logPageVisit } from "../../admin/activity-actions";
import {
  CUSTOMER_PREVIEW_READ_ONLY_MESSAGE,
  CustomerPreviewReadOnlyError,
} from "@/modules/customer_preview";

afterEach(() => {
  for (const fn of Object.values(writes)) expect(fn).not.toHaveBeenCalled();
  jest.clearAllMocks();
});

describe("template customer mutations refuse a preview session", () => {
  it("updateUserNames", async () => {
    await expect(updateUserNames("A", "B")).rejects.toBeInstanceOf(CustomerPreviewReadOnlyError);
  });

  it("inviteTeamMember", async () => {
    await expect(inviteTeamMember("x@example.com")).rejects.toBeInstanceOf(
      CustomerPreviewReadOnlyError,
    );
  });

  it("updateCustomerProfileRequest", async () => {
    await expect(
      updateCustomerProfileRequest({ requestType: "contact_update", requestDetails: "x" }),
    ).rejects.toBeInstanceOf(CustomerPreviewReadOnlyError);
  });

  it("generateCustomerAccountMagicLink", async () => {
    await expect(generateCustomerAccountMagicLink("42")).resolves.toEqual({
      error: CUSTOMER_PREVIEW_READ_ONLY_MESSAGE,
    });
  });

  it("generateCustomerUserMagicLink", async () => {
    await expect(generateCustomerUserMagicLink("3")).resolves.toEqual({
      error: CUSTOMER_PREVIEW_READ_ONLY_MESSAGE,
    });
  });

  it("accountActivity", async () => {
    await expect(
      accountActivity({ type: "forms", details: "d", message: "m" }),
    ).resolves.toEqual({ success: false, error: CUSTOMER_PREVIEW_READ_ONLY_MESSAGE });
  });

  it("logPageVisit (an admin's preview is not the customer's visit)", async () => {
    await expect(logPageVisit("/account")).resolves.toBeUndefined();
  });
});

describe("…and still work for a real customer", () => {
  it("updateUserNames writes for a non-preview session", async () => {
    const { customerPreview: _omit, ...user } = previewSession.user;
    mockRequireCustomer.mockResolvedValueOnce({ ...previewSession, user } as never);
    writes.updateContact.mockResolvedValueOnce({ id: 1 });
    await expect(updateUserNames("A", "B")).resolves.toMatchObject({ success: true });
    expect(writes.updateContact).toHaveBeenCalledTimes(1);
    writes.updateContact.mockClear(); // the afterEach guard is for preview cases
  });
});
