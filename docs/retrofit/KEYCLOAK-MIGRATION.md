# Keycloak Migration

> **Human overview.** To actually migrate an app, run one of the agent prompts —
> [2026-06-10-keycloak-auth-internal-only.md](2026-06-10-keycloak-auth-internal-only.md)
> (Mapp employees only) or
> [2026-06-10-keycloak-auth-company-context.md](2026-06-10-keycloak-auth-company-context.md)
> (customers too). They are the maintained, step-by-step version of this page; the
> reference for the end state is [`docs/template/KEYCLOAK.md`](../template/KEYCLOAK.md).

This guide is for existing Labs apps that were created before Keycloak support was added to the template.

Use it when:

- the app already exists and deploys from an older `labs-app-template` base
- internal admin login currently uses direct Azure/Entra
- you want to switch internal login to Keycloak while preserving the existing app session/admin model

## Migration Goal

Move from:

- Labs app -> Azure AD / Entra directly

to:

- Labs app -> Keycloak -> optional upstream broker (for example Entra)

without rewriting the app’s internal admin guards and session shape.

## Expected App-Level Result

After migration, internal Mapp users should still end up with:

- `session.user.role = "admin"`
- `session.user.email`
- `session.user.name`
- `session.user.isSuperAdmin`
- `session.user.access`

And the app should additionally expose:

- `session.user.authSource = "keycloak"`
- `session.user.identityProvider`
- `session.user.mappLdapGroups`

The app should still treat these as separate concerns:

- primary app authorization:
  - `role`
  - `isSuperAdmin`
  - `access`
- identity/debug/enrichment data:
  - `authSource`
  - `identityProvider`
  - `mappLdapGroups`

## Recommended Migration Sequence

1. Rebase or merge the updated template auth changes into your app.
2. Verify the app now supports:
   - `KEYCLOAK_ENABLED`
   - `KEYCLOAK_ISSUER`
   - `KEYCLOAK_CLIENT_ID`
   - `KEYCLOAK_CLIENT_SECRET`
   - `KEYCLOAK_IDP_HINT`
   - `KEYCLOAK_TLS_INSECURE` (temporary only)
3. Update deployment wiring so those values can be injected through SSM/ECS.
4. Set environment SSM values for staging.
5. Deploy to staging first.
6. Validate `/auth/admin` and `/admin/auth-debug`.
7. Only after staging is stable, repeat for production.

Important runtime note:

- `/auth/admin` must evaluate the internal provider choice at runtime
- `KEYCLOAK_ENABLED=true` should route to Keycloak
- `KEYCLOAK_ENABLED=false` should route to the old direct Entra path

## Required Code Areas

For older apps, the following areas matter most:

- Keycloak provider in NextAuth config
- session/JWT typing for:
  - `authSource`
  - `identityProvider`
  - `mappLdapGroups`
- internal admin hydration path
- deploy wiring for Keycloak SSM parameters

## SSM Changes

Existing apps usually already have:

- `NEXTAUTH_SECRET`
- `SUPER_ADMINS`
- `AZURE_AD_CLIENT_ID`
- `AZURE_AD_CLIENT_SECRET`
- `AZURE_AD_TENANT_ID`

Add:

- `KEYCLOAK_ENABLED`
- `KEYCLOAK_ISSUER`
- `KEYCLOAK_CLIENT_ID`
- `KEYCLOAK_CLIENT_SECRET`
- `KEYCLOAK_IDP_HINT`

Recommended:

- set `KEYCLOAK_IDP_HINT` to the broker alias in the target Keycloak realm when you want app-driven broker auto-selection
- for example, `mapp-entra-id` in the `labs` realm
- this keeps the redirect behavior app-specific instead of forcing a realm-global browser-flow change

Optional:

- `KEYCLOAK_CA_PEM`
- `KEYCLOAK_TLS_INSECURE`

If the Keycloak environment requires a CA bundle, prefer:

```bash
make staging-keycloak-ca-update
```

instead of manually pasting PEM blocks into the generic SSM setup prompt.

## Staging-First Rule

Do not switch an existing app straight to production-first Keycloak auth.

Recommended order:

1. staging deploy
2. brokered login validation
3. session/debug validation
4. only then production rollout

## What Not To Do

Do not:

- hardcode environment-specific certificates in git
- enable `KEYCLOAK_TLS_INSECURE=true` globally across apps
- rewrite app-specific access logic just to adopt Keycloak

The migration goal is compatibility first.

## When LDAP Groups Are Expected

If the target Keycloak realm does not yet include the LDAP mapper deploy:

- login may still work
- `mappLdapGroups` may still be empty

That is still a valid Phase A brokered-auth proof.

Only after the Keycloak mapper is deployed should you expect real LDAP groups in the final session.
