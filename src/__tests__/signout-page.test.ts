/** @jest-environment node */

/**
 * /auth/signout must end the Keycloak SSO session, not just the app session.
 *
 * It does that by redirecting to Keycloak's end-session endpoint with the
 * login's id_token as `id_token_hint`. These tests use the REAL next-auth
 * `encode` / `getToken` on purpose: the page once handed getToken a raw Cookie
 * header, which getToken ignores, so the token was always null and the Keycloak
 * logout silently never happened. A mocked getToken would not have caught that.
 */

import { encode } from "next-auth/jwt";

const SECRET = "test-secret-test-secret-test-secret-test";

jest.mock("@/config", () => ({
  config: {
    app: { url: "https://app.example.com" },
    keycloak: { enabled: true, issuer: "https://kc.example.com/realms/labs/" },
    magicLink: { enabled: false },
  },
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

let cookieJar: { name: string; value: string }[] = [];
jest.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => cookieJar }),
}));

const mockGetAuthSessionIdToken = jest.fn();
jest.mock("@/modules/auth/server/auth-session", () => ({
  getAuthSessionIdToken: (...args: unknown[]) =>
    mockGetAuthSessionIdToken(...args),
}));

jest.mock("@/app/auth/signout/SignOutClient", () => ({
  __esModule: true,
  default: () => null,
}));

import SignOutPage from "@/app/auth/signout/page";

/** Set the session cookie the way NextAuth does, chunking past ~4 KB. */
async function setSessionCookie(token: Record<string, unknown>, name: string) {
  const value = await encode({ token, secret: SECRET });
  const CHUNK = 3933;
  cookieJar =
    value.length <= CHUNK
      ? [{ name, value }]
      : Array.from({ length: Math.ceil(value.length / CHUNK) }, (_, i) => ({
          name: `${name}.${i}`,
          value: value.slice(i * CHUNK, (i + 1) * CHUNK),
        }));
}

async function endSessionUrl(): Promise<string | null> {
  const element = (await SignOutPage({ searchParams: {} })) as {
    props: { endSessionUrl: string | null };
  };
  return element.props.endSessionUrl;
}

describe("/auth/signout — Keycloak federated logout", () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = SECRET;
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    cookieJar = [];
    mockGetAuthSessionIdToken.mockReset();
  });

  afterAll(() => {
    process.env = env;
  });

  it("builds the end-session URL from the id_token on the auth_session row", async () => {
    mockGetAuthSessionIdToken.mockResolvedValue("the.id.token");
    await setSessionCookie(
      { role: "admin", email: "a@mapp.com", authSessionId: "row-1" },
      "next-auth.session-token",
    );

    const url = new URL((await endSessionUrl())!);

    expect(mockGetAuthSessionIdToken).toHaveBeenCalledWith("row-1");
    expect(url.origin + url.pathname).toBe(
      "https://kc.example.com/realms/labs/protocol/openid-connect/logout",
    );
    expect(url.searchParams.get("id_token_hint")).toBe("the.id.token");
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe(
      "http://localhost:3000/auth/signout?kc=done",
    );
  });

  it("reads the __Secure- cookie on https deployments", async () => {
    process.env.NEXTAUTH_URL = "https://myapp.labs.mapp.com";
    mockGetAuthSessionIdToken.mockResolvedValue("the.id.token");
    await setSessionCookie(
      { role: "admin", email: "a@mapp.com", authSessionId: "row-1" },
      "__Secure-next-auth.session-token",
    );

    expect(await endSessionUrl()).toContain("id_token_hint=the.id.token");
  });

  it("still logs out sessions issued before auth_session (inline id_token, chunked cookie)", async () => {
    const legacyIdToken = `header.${"p".repeat(9000)}.sig`;
    await setSessionCookie(
      { role: "admin", email: "a@mapp.com", keycloakIdToken: legacyIdToken },
      "next-auth.session-token",
    );
    expect(cookieJar.length).toBeGreaterThan(1);

    const url = new URL((await endSessionUrl())!);

    expect(mockGetAuthSessionIdToken).not.toHaveBeenCalled();
    expect(url.searchParams.get("id_token_hint")).toBe(legacyIdToken);
  });

  it("falls back to an app-only sign-out when there is no id_token", async () => {
    mockGetAuthSessionIdToken.mockResolvedValue(null);
    await setSessionCookie(
      { role: "customer", email: "c@example.com", authSessionId: "gone" },
      "next-auth.session-token",
    );

    expect(await endSessionUrl()).toBeNull();
  });

  it("falls back to an app-only sign-out when there is no session at all", async () => {
    expect(await endSessionUrl()).toBeNull();
  });
});
