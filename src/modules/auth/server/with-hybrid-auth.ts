import { validateKeycloakToken } from './keycloak-validator';
import { getAdminSession } from './require-auth';
import { NextRequest, NextResponse } from 'next/server';
import type { KeycloakHandler } from './with-keycloak';

export function withHybridAuth(handler: KeycloakHandler) {
  return async (req: NextRequest) => {
    const keycloakHeader = req.headers.get('Keycloak-auth');

    if (keycloakHeader !== 'true') {
      // Admin auth path — validate session and pass sub as the session email
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return handler(req, { sub: session.user.email ?? undefined });
    }

    // Keycloak auth path
    const authHeader = req.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const token = authHeader.slice(7);
      const claims = await validateKeycloakToken(token);
      return handler(req, claims);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
  };
}
