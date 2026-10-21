import { validateKeycloakToken } from './keycloak-validator';
import type { JWTPayload } from 'jose';

export type KeycloakHandler = (req: Request, claims: JWTPayload) => Promise<Response>;

export function withKeycloak(handler: KeycloakHandler) {
  return async (req: Request) => {
    const authHeader = req.headers.get('Authorization');
    const keycloakHeader = req.headers.get('Keycloak-auth');

    if (!authHeader?.startsWith('Bearer ') || keycloakHeader !== 'true') {
      return new Response('Unauthorized', { status: 401 });
    }

    const token = authHeader.slice(7);

    try {
      const claims = await validateKeycloakToken(token);
      return handler(req, claims);
    } catch {
      return new Response('Invalid token', { status: 401 });
    }
  };
}
