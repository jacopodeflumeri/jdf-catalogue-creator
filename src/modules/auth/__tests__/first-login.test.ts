/** @jest-environment node */

/**
 * Tests for the new-member bootstrap access model in hydrateInternalAdminUser:
 *   - the FIRST Mapp user ever (no team members) -> active/admin
 *   - everyone after                              -> active/viewer
 * (No pending/approval step.)
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

const mockCountTeamMembers = jest.fn();
jest.mock("@/lib/prisma/services", () => ({
  prismaService: {
    mappTeam: { countTeamMembers: (...a: any[]) => mockCountTeamMembers(...a) },
  },
}));

const mockGetRaw = jest.fn();
const mockUpdate = jest.fn();
jest.mock("../server/team-member-actions", () => ({
  getRawTeamMemberByEmailAction: (...a: any[]) => mockGetRaw(...a),
  updateTeamMemberForAuthAction: (...a: any[]) => mockUpdate(...a),
}));

const mockCreateFromAzure = jest.fn();
jest.mock("../server/team-member-service", () => ({
  MappTeamMemberService: {
    createTeamMemberFromAzureAD: (...a: any[]) => mockCreateFromAzure(...a),
    getGraphProfileData: jest.fn(),
    createTeamMemberData: jest.fn(),
  },
}));

import { hydrateInternalAdminUser } from "../server/internal-admin-auth";

function newUser() {
  return { role: "admin" } as any;
}

const identity = {
  email: "someone@mapp.com",
  name: "Some One",
  authSource: "keycloak" as const,
  identityProvider: "entra" as const,
};

function createdMemberWith(overrides: any) {
  // Mimic the service: echo the access overrides onto the created row.
  return {
    id: 1,
    created_at: Math.floor(Date.now() / 1000),
    email: identity.email,
    firstname: "Some",
    lastname: "One",
    title: "Admin",
    role: "Admin",
    accessStatus: overrides?.accessStatus,
    accessLevel: overrides?.accessLevel,
    isSuperAdmin: false,
  };
}

describe("hydrateInternalAdminUser new-member bootstrap", () => {
  beforeEach(() => {
    mockCountTeamMembers.mockReset();
    mockGetRaw.mockReset();
    mockUpdate.mockReset();
    mockCreateFromAzure.mockReset();
    // New user: no existing record.
    mockGetRaw.mockResolvedValue({ success: true, data: null });
    mockCreateFromAzure.mockImplementation(
      async (_p: any, _g: any, _r: any, overrides: any) =>
        createdMemberWith(overrides),
    );
  });

  it("first user ever -> active/admin", async () => {
    mockCountTeamMembers.mockResolvedValue(0);
    const user = newUser();
    const ok = await hydrateInternalAdminUser(user, identity);
    expect(ok).toBe(true);
    const overrides = mockCreateFromAzure.mock.calls[0][3];
    expect(overrides).toEqual({ accessStatus: "active", accessLevel: "admin" });
    expect(user.adminData.accessLevel).toBe("admin");
  });

  it("subsequent users -> active/viewer", async () => {
    mockCountTeamMembers.mockResolvedValue(3);
    const user = newUser();
    const ok = await hydrateInternalAdminUser(user, identity);
    expect(ok).toBe(true);
    const overrides = mockCreateFromAzure.mock.calls[0][3];
    expect(overrides).toEqual({ accessStatus: "active", accessLevel: "viewer" });
    expect(user.adminData.accessLevel).toBe("viewer");
  });
});
