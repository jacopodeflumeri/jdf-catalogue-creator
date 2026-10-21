import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';

// Lazily build the JWKS set on first use. Building it at module load with
// `new URL(`${process.env.KEYCLOAK_ISSUER}/...`)` throws "Invalid URL" during
// `next build` whenever KEYCLOAK_ISSUER is unset (e.g. an internal-only app that
// builds without Keycloak), because the health-keycloak route imports this file.
let jwks: JWTVerifyGetKey | undefined;

function getJwks(issuer: string): JWTVerifyGetKey {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`${issuer}/protocol/openid-connect/certs`),
    );
  }
  return jwks;
}

export async function validateKeycloakToken(token: string) {
  const issuer = process.env.KEYCLOAK_ISSUER;
  if (!issuer) {
    throw new Error('KEYCLOAK_ISSUER is not configured');
  }
  try {
    const { payload } = await jwtVerify(token, getJwks(issuer), { issuer });
    return payload;
  } catch (_err) {
    throw new Error('Invalid token');
  }
}
