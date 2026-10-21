import { redirect } from "next/navigation";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { config } from "@/config";
import { getAuthSessionIdToken } from "@/modules/auth/server/auth-session";
import SignOutClient from "./SignOutClient";

// Read the JWT at request time to build the Keycloak federated-logout URL.
export const dynamic = "force-dynamic";

export default async function SignOutPage({
  searchParams,
}: {
  searchParams: Promise<{ kc?: string }> | { kc?: string };
}) {
  const params = await searchParams;
  const loginPath = config.keycloak.enabled
    ? "/auth/admin"
    : config.magicLink.enabled
      ? "/auth/signin"
      : "/auth/admin";

  // Returning from Keycloak's end-session redirect — the SSO session is now
  // ended and the app session was already cleared, so just go to the login page.
  if (params?.kc === "done") {
    redirect(loginPath);
  }

  // The id_token is deliberately not on session.user, so it never reaches client
  // JS. It lives on the server-side auth_session row; the JWT holds that row's id.
  // getToken() reads `req.cookies` and never parses a raw Cookie header, so it
  // must be handed the cookie store itself. (Passing only `headers.cookie` made
  // it return null every time: no id_token, no Keycloak logout, and the next
  // login passed straight through without a prompt.)
  const token = await getToken({
    req: { cookies: await cookies(), headers: {} } as never,
    secret: process.env.NEXTAUTH_SECRET,
    // Match NextAuth's cookie naming (`__Secure-` prefix) for https deployments.
    secureCookie: (process.env.NEXTAUTH_URL ?? "").startsWith("https://"),
  });
  // `token.keycloakIdToken` is the legacy location, still honored for sessions
  // issued before the auth_session table existed.
  const idToken = token?.authSessionId
    ? await getAuthSessionIdToken(token.authSessionId)
    : token?.keycloakIdToken;

  // Build the RP-initiated logout URL when we have a Keycloak id_token. The
  // post-logout redirect must be registered on the labs-portal client
  // (`/auth/signout*` is registered by register-keycloak-uris.sh).
  let endSessionUrl: string | null = null;
  if (config.keycloak.enabled && config.keycloak.issuer && idToken) {
    const base = (process.env.NEXTAUTH_URL || config.app.url || "").replace(
      /\/$/,
      "",
    );
    const postLogout = `${base}/auth/signout?kc=done`;
    const issuer = config.keycloak.issuer.replace(/\/$/, "");
    endSessionUrl =
      `${issuer}/protocol/openid-connect/logout` +
      `?id_token_hint=${encodeURIComponent(idToken)}` +
      `&post_logout_redirect_uri=${encodeURIComponent(postLogout)}`;
  }

  return <SignOutClient endSessionUrl={endSessionUrl} fallbackPath="/" />;
}
