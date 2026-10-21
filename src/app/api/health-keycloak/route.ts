import { withHybridAuth } from '@/modules/auth/server/with-hybrid-auth';
import { withKeycloak } from '@/modules/auth/server/with-keycloak';

export const GET = withKeycloak(async (req, claims) => {

  return Response.json({
    message: 'Secure endpoint accessed with valid Keycloak token',
    subject: claims.sub,
    client: claims.azp,
  });
});
export const POST = withHybridAuth(async (req, claims) => {

  return Response.json({
    message: 'Secure endpoint accessed with valid Keycloak token/admin auth',
    subject: claims.sub,
    client: claims.azp,
  });
});
