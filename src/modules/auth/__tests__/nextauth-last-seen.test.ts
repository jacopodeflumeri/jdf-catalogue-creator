/** @jest-environment node */

/**
 * Tests for the throttled "last seen" update in the NextAuth JWT callback.
 *
 * The jwt callback should update lastLoginAt at most once per 5 minutes,
 * and never at sign-in time (the signIn callback no longer writes it).
 */

jest.mock("@/config", () => ({
  config: {
    auth: {
      secret: "test-secret",
      sessionMaxAge: 86400,
      superAdmins: [],
      restrictions: {},
    },
    app: { isDevelopment: false },
    azure: { clientId: "test", clientSecret: "test", tenantId: "test" },
    magicLink: { enabled: false },
    devAuth: { enabled: false },
    keycloak: {
      enabled: false,
      issuer: "",
      clientId: "",
      clientSecret: "",
      idpHint: "",
      companyIdpHint: "",
      caPem: "",
      tlsInsecure: false,
    },
  },
}));

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

// The nextauth module imports MappTeamMemberService, which pulls in the
// S3 module and triggers env validation. Stub it out — we don't exercise
// it from the jwt callback.
jest.mock("../server/team-member-service", () => ({
  MappTeamMemberService: {},
}));

// nextauth now imports the internal-admin + company-user hydrators, which import
// prismaService (constructing a real Prisma client at import time → needs
// DB_NAME). The jwt callback under test doesn't touch the DB directly, so stub
// the services module so importing nextauth doesn't build a client.
jest.mock("@/lib/prisma/services", () => ({
  prismaService: {
    mappTeam: { countTeamMembers: jest.fn() },
    companyUser: {},
  },
}));

const mockGetRawTeamMemberByEmailAction = jest.fn();
const mockUpdateTeamMemberForAuthAction = jest.fn();

jest.mock("@/modules/auth/server", () => ({
  getRawTeamMemberByEmailAction: (...args: any[]) =>
    mockGetRawTeamMemberByEmailAction(...args),
  updateTeamMemberForAuthAction: (...args: any[]) =>
    mockUpdateTeamMemberForAuthAction(...args),
}));

import { authOptions } from "../config/nextauth";

const jwtCallback = authOptions.callbacks!.jwt!;

function adminToken(overrides: Record<string, unknown> = {}) {
  return {
    role: "admin",
    email: "admin@example.com",
    adminId: "42",
    ...overrides,
  } as any;
}

function teamMember(lastLoginAt: Date | null) {
  return {
    success: true,
    data: {
      id: 42,
      isSuperAdmin: false,
      accessLevel: "admin",
      lastLoginAt,
    },
  };
}

describe("nextauth jwt callback — throttled last-seen update", () => {
  beforeEach(() => {
    mockGetRawTeamMemberByEmailAction.mockReset();
    mockUpdateTeamMemberForAuthAction.mockReset();
    mockUpdateTeamMemberForAuthAction.mockResolvedValue(undefined);
  });

  it("updates lastLoginAt when it has never been set", async () => {
    mockGetRawTeamMemberByEmailAction.mockResolvedValue(teamMember(null));

    await jwtCallback({ token: adminToken() } as any);

    expect(mockUpdateTeamMemberForAuthAction).toHaveBeenCalledTimes(1);
    expect(mockUpdateTeamMemberForAuthAction).toHaveBeenCalledWith(
      "42",
      expect.objectContaining({ lastLoginAt: expect.any(Date) }),
    );
  });

  it("updates lastLoginAt when more than 5 minutes have elapsed", async () => {
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    mockGetRawTeamMemberByEmailAction.mockResolvedValue(
      teamMember(sixMinutesAgo),
    );

    await jwtCallback({ token: adminToken() } as any);

    expect(mockUpdateTeamMemberForAuthAction).toHaveBeenCalledTimes(1);
  });

  it("does NOT update lastLoginAt when less than 5 minutes have elapsed", async () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    mockGetRawTeamMemberByEmailAction.mockResolvedValue(
      teamMember(twoMinutesAgo),
    );

    await jwtCallback({ token: adminToken() } as any);

    expect(mockUpdateTeamMemberForAuthAction).not.toHaveBeenCalled();
  });

  it("does not crash if the update rejects (fire-and-forget)", async () => {
    mockGetRawTeamMemberByEmailAction.mockResolvedValue(teamMember(null));
    mockUpdateTeamMemberForAuthAction.mockRejectedValue(new Error("db down"));

    await expect(jwtCallback({ token: adminToken() } as any)).resolves.toEqual(
      expect.objectContaining({ role: "admin" }),
    );
  });

  it("does not update for non-admin tokens", async () => {
    const customerToken = {
      role: "customer",
      email: "c@example.com",
      userId: "u1",
    };

    await jwtCallback({ token: customerToken } as any);

    expect(mockGetRawTeamMemberByEmailAction).not.toHaveBeenCalled();
    expect(mockUpdateTeamMemberForAuthAction).not.toHaveBeenCalled();
  });

  it("does not update when the DB lookup returns no team member", async () => {
    mockGetRawTeamMemberByEmailAction.mockResolvedValue({
      success: true,
      data: null,
    });

    await jwtCallback({ token: adminToken() } as any);

    expect(mockUpdateTeamMemberForAuthAction).not.toHaveBeenCalled();
  });
});
