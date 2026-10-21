# Keycloak API Token Auth

Accept **Keycloak-issued OAuth2 bearer tokens** on your API routes — for
machine-to-machine callers or other services that already hold a Keycloak SSO
token — validated against the realm JWKS. (Originated from CONNECT-1446; ships in
the template auth module.)

This is distinct from the interactive Company Login flow: that brokers a browser
login into a NextAuth session; this validates a raw bearer token on an API call.

## Requirements

- `KEYCLOAK_ISSUER` must be set (the JWKS is fetched from
  `<issuer>/protocol/openid-connect/certs`). The validator builds the JWKS set
  lazily, so an app that builds without Keycloak won't crash at build time — but
  calls will return 401 until `KEYCLOAK_ISSUER` is configured.

## Route wrappers

```ts
import { withKeycloak } from '@/modules/auth/server/with-keycloak';
import { withHybridAuth } from '@/modules/auth/server/with-hybrid-auth';
```

- **`withKeycloak(handler)`** — requires `Authorization: Bearer <token>` and the
  `Keycloak-auth: true` header; verifies the token and calls
  `handler(req, claims)`. 401 otherwise.
- **`withHybridAuth(handler)`** — accepts EITHER a NextAuth admin session OR a
  Keycloak bearer token (when `Keycloak-auth: true`). Use for endpoints that
  serve both the admin UI and token callers.

## Health probe

`GET /api/health-keycloak` — quick check that JWKS/issuer wiring is reachable.

## Files

- `src/modules/auth/server/keycloak-validator.ts` — `validateKeycloakToken()`
- `src/modules/auth/server/with-keycloak.ts`
- `src/modules/auth/server/with-hybrid-auth.ts`
- `src/app/api/health-keycloak/route.ts`
