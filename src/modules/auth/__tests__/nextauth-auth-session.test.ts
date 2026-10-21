/** @jest-environment node */

/**
 * The session cookie must not grow with the user's profile.
 *
 * roles / workspaces / mappLdapGroups and the Keycloak id_token used to be
 * stored on the JWT, which IS the session cookie. Users with many LDAP groups
 * went past Node's 16 KB request-header limit and got HTTP 431 on every page.
 * They now live in the auth_session table; these tests pin that down.
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

jest.mock("../server/team-member-service", () => ({
  MappTeamMemberService: {},
}));

jest.mock("@/lib/prisma/services", () => ({
  prismaService: {
    mappTeam: { countTeamMembers: jest.fn() },
    companyUser: {},
    authSession: {
      create: jest.fn(),
      getClaims: jest.fn(),
      getKeycloakIdToken: jest.fn(),
      extend: jest.fn(),
      delete: jest.fn(),
      deleteExpired: jest.fn(),
    },
  },
}));

jest.mock("@/modules/auth/server", () => ({
  getRawTeamMemberByEmailAction: jest.fn(),
  updateTeamMemberForAuthAction: jest.fn(),
}));

import { encode } from "next-auth/jwt";
import { authOptions } from "../config/nextauth";
import { prismaService } from "@/lib/prisma/services";

const mockAuthSession = prismaService.authSession as unknown as Record<
  string,
  jest.Mock
>;

const jwtCallback = authOptions.callbacks!.jwt!;
const sessionCallback = authOptions.callbacks!.session!;

const DAY_MS = 86400 * 1000;

// A deliberately heavy profile: far past what used to trip the 16 KB limit.
const groups = Array.from(
  { length: 200 },
  (_, i) => `CN=LABS-SOME-DEPARTMENT-GROUP-${i},OU=Groups,DC=mapp,DC=com`,
);
const workspaces = Array.from({ length: 40 }, (_, i) => ({
  workspaceId: `workspace-${i}`,
  services: ["engage", "intelligence", "fashion"],
}));
const roles = ["labs-user", "offline_access"];
const idToken = `header.${"p".repeat(20000)}.signature`;

function companyUser() {
  return {
    id: "u1",
    role: "customer",
    email: "user@example.com",
    name: "Some User",
    authSource: "keycloak",
    identityProvider: "mapp-cloud",
    companyId: "123",
    userId: "19140",
    roles,
    workspaces,
    mappLdapGroups: groups,
  } as any;
}

function signIn(
  user = companyUser(),
  account: any = { provider: "keycloak", id_token: idToken },
) {
  return jwtCallback({
    token: { name: user.name, email: user.email, sub: user.id },
    user,
    account,
  } as any);
}

describe("nextauth — server-side auth session", () => {
  beforeEach(() => {
    Object.values(mockAuthSession).forEach((fn) => fn.mockReset());
    mockAuthSession.create.mockResolvedValue("session-row-1");
    mockAuthSession.deleteExpired.mockResolvedValue(0);
    mockAuthSession.extend.mockResolvedValue(undefined);
    mockAuthSession.delete.mockResolvedValue(undefined);
  });

  it("stores the large claims and id_token in auth_session, not on the JWT", async () => {
    const token = await signIn();

    expect(mockAuthSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@example.com",
        roles,
        workspaces,
        mappLdapGroups: groups,
        keycloakIdToken: idToken,
        expiresAt: expect.any(Date),
      }),
    );
    expect(token.authSessionId).toBe("session-row-1");
    expect(token.roles).toBeUndefined();
    expect(token.workspaces).toBeUndefined();
    expect(token.mappLdapGroups).toBeUndefined();
    expect(token.keycloakIdToken).toBeUndefined();
  });

  it("keeps the encoded session cookie small no matter how large the profile is", async () => {
    const token = await signIn();
    const cookie = await encode({ token, secret: "x".repeat(44) });

    // If this fails you have put something profile-sized back on the JWT.
    // Store it on the auth_session row instead.
    expect(cookie.length).toBeLessThan(1500);
  });

  it("fails the login when the claims cannot be stored", async () => {
    mockAuthSession.create.mockRejectedValue(new Error("db down"));

    await expect(signIn()).rejects.toThrow("db down");
  });

  it("falls back to inline claims only while the table has not been migrated in", async () => {
    mockAuthSession.create.mockRejectedValue(
      Object.assign(new Error("table does not exist"), { code: "P2021" }),
    );

    const token = await signIn();

    expect(token.authSessionId).toBeUndefined();
    expect(token.mappLdapGroups).toEqual(groups);
    expect(token.keycloakIdToken).toBe(idToken);
  });

  it("creates no row when there is nothing to store", async () => {
    const token = await signIn(
      { id: "u2", role: "customer", email: "m@example.com", name: "M" } as any,
      { provider: "magic-link" },
    );

    expect(mockAuthSession.create).not.toHaveBeenCalled();
    expect(token.authSessionId).toBeUndefined();
  });

  it("puts the stored claims back on session.user", async () => {
    mockAuthSession.getClaims.mockResolvedValue({
      roles,
      workspaces,
      mappLdapGroups: groups,
      expiresAt: new Date(Date.now() + DAY_MS),
    });

    const session = await sessionCallback({
      session: { user: {}, expires: "" },
      token: {
        role: "customer",
        email: "user@example.com",
        authSessionId: "session-row-1",
      },
    } as any);

    expect(mockAuthSession.getClaims).toHaveBeenCalledWith("session-row-1");
    expect(session.user.roles).toEqual(roles);
    expect(session.user.workspaces).toEqual(workspaces);
    expect(session.user.mappLdapGroups).toEqual(groups);
    expect((session.user as any).keycloakIdToken).toBeUndefined();
    expect((session.user as any).authSessionId).toBeUndefined();
    expect(mockAuthSession.extend).not.toHaveBeenCalled();
  });

  it("rolls the row's expiry forward once it is past half its lifetime", async () => {
    mockAuthSession.getClaims.mockResolvedValue({
      roles,
      expiresAt: new Date(Date.now() + DAY_MS / 4),
    });

    await sessionCallback({
      session: { user: {}, expires: "" },
      token: {
        role: "customer",
        email: "user@example.com",
        authSessionId: "session-row-1",
      },
    } as any);

    expect(mockAuthSession.extend).toHaveBeenCalledWith(
      "session-row-1",
      expect.any(Date),
    );
  });

  it("yields a session without the claims when the row is gone or the read fails", async () => {
    for (const setup of [
      () => mockAuthSession.getClaims.mockResolvedValue(null),
      () => mockAuthSession.getClaims.mockRejectedValue(new Error("db down")),
    ]) {
      setup();
      const session = await sessionCallback({
        session: { user: {}, expires: "" },
        token: {
          role: "customer",
          email: "user@example.com",
          authSessionId: "gone",
        },
      } as any);

      expect(session.user.email).toBe("user@example.com");
      expect(session.user.roles).toBeUndefined();
      expect(session.user.workspaces).toBeUndefined();
      expect(session.user.mappLdapGroups).toBeUndefined();
    }
  });

  it("still honors claims carried inline by sessions issued before auth_session", async () => {
    const session = await sessionCallback({
      session: { user: {}, expires: "" },
      token: {
        role: "customer",
        email: "user@example.com",
        roles,
        workspaces,
        mappLdapGroups: groups,
      },
    } as any);

    expect(mockAuthSession.getClaims).not.toHaveBeenCalled();
    expect(session.user.roles).toEqual(roles);
    expect(session.user.workspaces).toEqual(workspaces);
    expect(session.user.mappLdapGroups).toEqual(groups);
  });

  it("deletes the row on sign-out", async () => {
    await authOptions.events!.signOut!({
      token: { authSessionId: "session-row-1" },
    } as any);

    expect(mockAuthSession.delete).toHaveBeenCalledWith("session-row-1");
  });
});
