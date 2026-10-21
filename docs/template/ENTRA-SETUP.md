# Microsoft Entra (Azure AD) — Legacy Direct Login

> **Most new Labs apps don't need this doc.** Keycloak is the recommended auth path; its "Mapp Entra ID" button brokers to Entra without your app touching Azure credentials directly. See [KEYCLOAK.md](KEYCLOAK.md).
>
> This page covers the **legacy direct-Entra** path — only relevant if you set `KEYCLOAK_ENABLED=false` for an older app that hasn't migrated.

When KC is disabled, NextAuth's Azure AD provider takes over and your app needs its own Entra credentials. All Mapp Labs apps share **one** Entra app registration; each adds its own redirect URI to that registration's `redirectUris` list via Microsoft Graph API during `make {env}-infra-deploy`.

## Local Development (legacy mode only)

If you set `KEYCLOAK_ENABLED=false` and want local Entra login working:

1. Get the shared Mapp Labs dev `AZURE_AD_*` credentials from the labs-platform team. They are **no longer committed** in `.env.example` — uncomment those lines and paste the values.
2. Confirm `http://localhost:3000/api/auth/callback/azure-ad` is registered on the shared Entra app (`make entra-redirects-list` shows the current list).

## Staging & Production Deployment

You do not need to file an ITHELPDESK ticket per project. The deploy pipeline registers your app's redirect URIs automatically via Microsoft Graph API.

### One-time AWS account setup

Run **once per AWS account** (not per project) to store the Graph API credentials that every Labs app uses:

```bash
make shared-ssm-setup
```

This prompts for four values and writes them to `/mapp-labs-shared/*` as SecureString SSM parameters:

| SSM Parameter | Description |
|---|---|
| `/mapp-labs-shared/ENTRA_MGMT_TENANT_ID` | Mapp Entra tenant (directory) ID |
| `/mapp-labs-shared/ENTRA_MGMT_OBJECT_ID` | Object ID of the shared Mapp Labs Entra app registration |
| `/mapp-labs-shared/ENTRA_MGMT_CLIENT_ID` | Client ID of the service principal with Graph API permission on the shared app |
| `/mapp-labs-shared/ENTRA_MGMT_CLIENT_SECRET` | Client secret for that service principal |

Ask IT for the current values. The `labs-power` AWS profile can read them; every Labs developer already has that profile.

Verify with:

```bash
make entra-redirects-list
```

which lists every redirect URI currently on the shared Entra app.

### Per-app setup

Nothing Entra-specific. Your app's redirect URI is derived from `app.config.json` and the target environment:

- Staging: `https://stg-{appName}.labs.mapp.com/api/auth/callback/azure-ad`
- Production: `https://{appName}.labs.mapp.com/api/auth/callback/azure-ad`

### What the deploy flow does

**`make staging-infra-deploy` / `make prod-infra-deploy`:**

1. CDK deploys the infra (ECS, RDS, ALB, Route53).
2. `scripts/deploy/entra-redirect-uri.sh add {env}` PATCHes the shared Entra app to include this app's redirect URI. Idempotent — safe to rerun. **Skipped when this app's `KEYCLOAK_ENABLED` SSM parameter is `true`**, because a Keycloak app never uses that URI. `make {env}-entra-add` run by hand is never skipped.
3. Icinga monitoring is registered.

**`make staging-infra-destroy`:**

1. Removes this app's redirect URI from the shared Entra app (`entra-redirect-uri.sh remove staging`).
2. Removes Icinga monitoring.
3. Destroys the CDK stack.
4. Deletes per-app SSM parameters.
5. Cleans up orphaned ACM validation CNAMEs.

Production has no automated destroy — use `make prod-entra-remove` explicitly if you ever retire a prod app.

**Keycloak apps with a leftover entry.** Before 2026-10-09 the registration was not skipped, so an app that was infra-deployed while already on Keycloak has an unused redirect URI on the shared Entra app. It is harmless; `make {env}-entra-remove` deletes it. `make entra-redirects-list` shows the full list.

### How the runtime auth works

The NextAuth Azure AD provider reads credentials from per-app SSM parameters set by `make {env}-ssm-setup`:

| SSM Parameter | Description |
|---|---|
| `/{app-name}-{env}/AZURE_AD_CLIENT_ID` | Application (client) ID of the shared Entra app |
| `/{app-name}-{env}/AZURE_AD_CLIENT_SECRET` | Client secret of the shared Entra app |
| `/{app-name}-{env}/AZURE_AD_TENANT_ID` | Mapp tenant ID |

These are injected as ECS container secrets — they never appear in CDK source or environment variables.

Because every Labs app uses the same underlying Entra registration, these three values are identical across projects today. When we migrate to Keycloak they'll be replaced.

### Tenant ID

The Mapp tenant ID is `e88f1bed-a5ea-407c-a42d-6966e9274ebb`. Same for every Mapp Labs app.

## Manual management

If the automated hook ever fails or you need to adjust the shared app out-of-band:

```bash
make entra-redirects-list       # inspect the full list
make staging-entra-add          # add this app's staging URI
make staging-entra-remove       # remove this app's staging URI
make prod-entra-add             # add this app's prod URI
make prod-entra-remove          # remove this app's prod URI
```

All actions are idempotent: `add` is a no-op if the URI is already registered; `remove` is a no-op if absent.

## Implementation notes

- The Graph API replaces the entire `redirectUris` array on every PATCH. `entra-redirect-uri.sh` follows a read-modify-write pattern (with `jq` `unique` on add, filter-out on remove) so concurrent Labs apps don't wipe each other's entries.
- Concurrency risk: two `make {env}-infra-deploy` runs happening simultaneously across two Labs apps could race. In practice deploys are serialized per-developer; if this becomes an issue, wrap the PATCH in an ETag-based conditional write.
- **Keycloak migration:** this is a short-term solution. Once we move to Keycloak, the `entra-*` scripts and SSM keys go away.
