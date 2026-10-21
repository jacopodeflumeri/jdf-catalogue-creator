# Shared Internal-API Credential

Internal Mapp services — the Company Management Service (client catalog), the
Product Feed Service (UPC), and others — are all reachable behind a **single
OAuth2 client-credentials credential** issued by Keycloak realm `s2s`.

Rather than each integration inventing its own `*_TOKEN_URL` / `*_CLIENT_ID` /
`*_CLIENT_SECRET` env trio, the template standardizes on **one** credential
shared by every internal client:

| Env var | Example | Notes |
|---|---|---|
| `INTERNAL_API_TOKEN_URL` | `https://auth.shortest-route.com/realms/s2s/protocol/openid-connect/token` (prod) / `https://idp-int.shortest-route.com/realms/s2s/...` (lower) | realm `s2s` token endpoint |
| `INTERNAL_API_CLIENT_ID` | `mapp-labs` | may be a dedicated `mapp-labs-<app>` if provisioned |
| `INTERNAL_API_CLIENT_SECRET` | — | read from shared SSM (below) |

Only **per-service base URLs** stay separate (`CLIENT_CATALOG_BASE_URL`,
`UPC_API_BASE_URL`, …). The auth is shared.

## Where the values come from — shared SSM (read this first)

**You do not need to ask anyone for these values, and you must not invent them.**
The real credential is already provisioned in a **shared** SSM namespace that every
Labs app reads from.

> ⚠️ **The shared namespace is per-environment.** Internal Mapp services are
> deployed once per environment — INT (`k8s-int-01`, Keycloak realm `s2s` on
> `idp-int.shortest-route.com`) and PROD (`k8s-prod-01`, realm `s2s` on
> `auth.shortest-route.com`). The `s2s` client id is the same (`mapp-labs`) in both,
> but **the secret differs per realm**: a production secret returns
> `unauthorized_client` against INT. Production keeps the original unsuffixed
> prefix; every other environment is suffixed.
>
> **A staging app that reads `/mapp-labs/*` silently talks to PRODUCTION** — it
> works, so the mistake is invisible. Always use the prefix for your environment.

| Environment | Shared prefix |
|---|---|
| production | `/mapp-labs` |
| staging | `/mapp-labs-stg` |

Within that prefix:

| SSM parameter | Type | Env var it populates |
|---|---|---|
| `<prefix>/internal-api/token-url` | String | `INTERNAL_API_TOKEN_URL` |
| `<prefix>/internal-api/client-id` | String | `INTERNAL_API_CLIENT_ID` (value: `mapp-labs`) |
| `<prefix>/internal-api/client-secret` | SecureString | `INTERNAL_API_CLIENT_SECRET` |
| `<prefix>/catalog/cms-base-url` | String | `CLIENT_CATALOG_BASE_URL` |

`infra/lib/stack.ts` resolves the prefix from the deploy environment, so an app
gets the right values automatically — there is nothing per-app to configure.

Read them with the `labs-power` profile in `eu-central-1`:

```bash
# staging
aws ssm get-parameters-by-path --path /mapp-labs-stg --recursive \
  --with-decryption --profile labs-power --region eu-central-1 \
  --query 'Parameters[].[Name,Value]' --output text

# production
aws ssm get-parameters-by-path --path /mapp-labs --recursive \
  --with-decryption --profile labs-power --region eu-central-1 \
  --query 'Parameters[].[Name,Value]' --output text
```

Per-service **base URLs are not secrets**, but they *are* per-environment — each
internal service has an INT and a PROD deployment:

| Env var | Environment | Value |
|---|---|---|
| `CLIENT_CATALOG_BASE_URL` | staging | `https://company-management-service.k8s-int-01.nbg.webtrekk.com/gum-service/api` |
| `CLIENT_CATALOG_BASE_URL` | production | `https://company-management-service.k8s-prod-01.nbg.webtrekk.com/gum-service/api` |

See [Client Catalog](./capabilities/CLIENT_CATALOG.md). Both are mirrored at
`<prefix>/catalog/cms-base-url`, which is the source of truth if a host ever moves.

Rules:

- **Never commit the secret.** Copy it into `.env` (gitignored) for local dev only.
- **Never ask the app owner to supply it** — they read it from the same place you do.
- If a parameter is missing, that is a labs-platform team task, not something to
  work around by inventing a URL or standing up a second credential.
- `/mapp-labs*` are the **shared** namespaces (`/mapp-labs` = production,
  `/mapp-labs-stg` = staging) and are read-only from an app's perspective. Do not
  write to them. An app's own params live under `/{appName}-stg/*` and
  `/{appName}-prod/*`.

## How it works

`src/lib/internal-api/oauth.ts` is the single token provider:

- `getInternalApiToken(config?)` — returns a valid access token, fetching via
  `client_credentials` and caching it in memory (keyed by token URL + client id,
  refreshed 60s before expiry).
- `getInternalApiOAuthConfigFromEnv()` — reads the three `INTERNAL_API_*` vars,
  or returns `null` if not all set.
- `clearInternalApiTokenCache()` — drops cached tokens; internal clients call
  this and retry once on a `401`.

Each internal client (e.g. `src/modules/client_catalog/lib/client.ts`,
`src/modules/upc/lib/client.ts`) obtains a Bearer token from this provider and
keeps only its own base URL.

## Authorization

The realm-`s2s` client **must be authorized for each internal service the app
calls** — authorization is per-service on the Keycloak side. The default
`mapp-labs` client is authorized for **both** the company-management-service
(client catalog) **and** the product-feed-service (UPC) — verified. If an app
calls a service `mapp-labs` is not authorized for, ask the labs-platform team to
grant it (or to provision a dedicated `mapp-labs-<app>` client) rather than
adding a second credential.

## TLS

The internal hosts present certificates issued by the Mapp internal root CA,
which is vendored in the image and trusted at the container layer — there is **no
per-service CA env var**. See [INTERNAL-CA.md](./INTERNAL-CA.md).

## Deployment

**There is nothing to seed and nothing to copy.** `infra/lib/stack.ts` references
the shared parameters directly:

```ts
INTERNAL_API_CLIENT_SECRET: ecs.Secret.fromSsmParameter(
  ssm.StringParameter.fromSecureStringParameterAttributes(this, "InternalApiClientSecret", {
    parameterName: `${sharedSsm}/internal-api/client-secret`,   // /mapp-labs[-stg]/...
  }),
),
```

where `sharedSsm` is `/mapp-labs` for production and `/mapp-labs-${shortEnv}`
otherwise, resolved from the deploy environment.

CDK grants the task execution role read on whatever ARN is referenced, so a staging
task role points at `…:parameter/mapp-labs-stg/internal-api/*` and a production one
at `…:parameter/mapp-labs/internal-api/*` — no app-scoped parameter exists.
`scripts/deploy/setup-ssm-params.sh` therefore seeds no `INTERNAL_API_*` params — it
only checks that the shared secret **for that environment** is readable and warns if
it isn't.

Consequences worth knowing:

- **Rotation is one write per environment.** Update
  `<prefix>/internal-api/client-secret` once, then restart each app's service in that
  environment. ECS resolves secrets at *task start*, so a running task keeps the old
  value until it's replaced (`make {env}-deploy`, or a force-new-deployment). The INT
  secret's upstream source of truth is `CLIENT_MAPP_LABS_SECRET` on the INT Keycloak
  pod (`platserv-keycloak`); production's is the equivalent on the prod pod.
- **A broken shared parameter breaks every app in that environment.** That's the
  trade for a single source of truth — treat both prefixes as critical.
- **Never mix environments.** The credential and the base URL must come from the same
  prefix. INT credential + prod base URL (or vice versa) fails with
  `unauthorized_client` / `401` — and prod credential + prod base URL from a *staging*
  app succeeds, which is worse: staging silently reads production data.
- **Apps must not write to `/mapp-labs*`.** They're read-only from an app's
  perspective; app-specific values belong under `/{appName}-{env}/*`.

### Base URLs

Per-service base URLs are **non-secret constants** (one deployment per service,
shared across all apps and environments), so they go in the task definition's
`environment`, not `secrets` — sourced from shared SSM via a CloudFormation dynamic
reference so the value still lives in exactly one place:

```ts
CLIENT_CATALOG_BASE_URL: ssm.StringParameter.valueForStringParameter(
  this,
  `${sharedSsm}/catalog/cms-base-url`,
),
```

This is present but **commented out** in `infra/lib/stack.ts` — uncomment the lines
for whichever capabilities the app enables.

## Adding a new internal integration

Don't add a new OAuth trio. Instead:

1. Add only the new service's base URL env var.
2. In the client, call `getInternalApiToken()` and send `Authorization: Bearer <token>`.
3. On a `401`, call `clearInternalApiTokenCache()` and retry once.
4. Confirm the `s2s` client is authorized for the new service (see above).
