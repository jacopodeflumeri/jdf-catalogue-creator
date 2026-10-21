# Keycloak Login

How login works in a Labs app built from this template: the two login buttons,
the session the app receives, the SSM wiring, redirect-URI registration, TLS, and
troubleshooting.

Keycloak is the default (`KEYCLOAK_ENABLED=true`). A new app needs **no** Azure
credentials, no Keycloak admin access and no manual Keycloak step — the shared
client secret auto-copies from shared SSM and the deploy registers the app's
redirect URI itself.

Related docs:

- [capabilities/COMPANY_LOGIN.md](capabilities/COMPANY_LOGIN.md) — the customer
  (company-context) path, eligibility and account seams, `COMPANY_LOGIN_ENABLED`
- [capabilities/DEV_LOGIN.md](capabilities/DEV_LOGIN.md) — local mock login
  without AWS or Keycloak (`/auth/dev`)
- [PERMISSION-LEVELS.md](PERMISSION-LEVELS.md) — viewer / editor / admin
- [ENTRA-SETUP.md](ENTRA-SETUP.md) — the legacy direct-Entra path
  (`KEYCLOAK_ENABLED=false`) only
- Pre-Keycloak apps: [`docs/retrofit/2026-06-10-keycloak-*`](../retrofit/README.md)
- Platform maintainers: [platform/KEYCLOAK-REGISTRAR-SETUP.md](platform/KEYCLOAK-REGISTRAR-SETUP.md)

## Quick start

**Local:**

1. Free one of ports **3000, 3001, 3002** (the three pre-registered on the shared
   client) and make sure `NEXTAUTH_URL` and `APP_URL` in
   `.env` use it:
   ```bash
   lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk '/:300[012] /'
   ```
2. Copy the shared client secret into `KEYCLOAK_CLIENT_SECRET=` in `.env` (never
   commit it):
   ```bash
   aws ssm get-parameter --name /labs/labs-portal/client-secret --with-decryption \
     --query Parameter.Value --output text --profile labs-power --region eu-central-1
   ```
3. `make dev-server`, open `http://localhost:3000/auth/admin`. You should see
   **Mapp Entra ID** and **Company Login**. If no Keycloak buttons appear,
   `KEYCLOAK_ENABLED` is not `true` in `.env`.

Don't need the real Keycloak? Set `DEV_AUTH_ENABLED=true` and use `/auth/dev`
instead (see [DEV_LOGIN.md](capabilities/DEV_LOGIN.md)).

**Deployed (staging):**

```bash
make staging-ssm-setup      # NEXTAUTH_SECRET (auto), SUPER_ADMINS, KEYCLOAK_ENABLED (true);
                            # the KC params auto-copy from /labs/labs-portal/*
make staging-first-deploy   # last step registers the redirect URI (needs Mapp VPN)
```

Then open `https://stg-{appName}.labs.mapp.com/auth/admin` and test both buttons.
Later releases: `make staging-deploy`.

## What the two login buttons do

Both buttons go through the shared `labs` realm via the shared `labs-portal` OIDC
client; the app's identity is the redirect URI it presents.

### Mapp Entra ID

For Mapp employees. Route: `app → labs realm → saml-sp realm → Entra ID`.
Lands on `/admin`.

The session carries `email`, `name`, `mappLdapGroups` (raw LDAP group names —
interpret per app), `isMappEmployee=true`, `identityProvider='entra'`.

### Company Login

For Mapp Cloud customers. Route: `app → labs realm → mapp-cloud realm`. Resolves
to a **customer** session and lands in the customer area (`/account`), not
`/admin`.

The session additionally carries the company context: `loginName`, `companyId`,
`tenantId`, `workspaces[]`, `roles[]`. See
[COMPANY_LOGIN.md](capabilities/COMPANY_LOGIN.md) for how the app maps a company
to an account and decides eligibility.

Mapp employees can use either button. If they use Company Login with an
`@mapp.com` email, `isMappEmployee` is also `true`.

### Choosing which buttons your app shows

Each button is conditional on its `*_IDP_HINT` env var; both hints are
auto-copied from shared SSM by `make {env}-ssm-setup`, so the default is both
buttons. To show one, delete the hint you don't need from the app's SSM and
redeploy:

**Internal-only app** (Mapp employees only):
```bash
aws ssm delete-parameter --name /{appname}-stg/KEYCLOAK_COMPANY_IDP_HINT \
  --profile labs-power --region eu-central-1
make staging-deploy
```
Also set `COMPANY_LOGIN_ENABLED=false` — that is what actually refuses external
company logins and hides the Company Users views; removing the hint only hides
the button. See [COMPANY_LOGIN.md](capabilities/COMPANY_LOGIN.md).

**Company-only app** (customers only):
```bash
aws ssm delete-parameter --name /{appname}-stg/KEYCLOAK_IDP_HINT \
  --profile labs-power --region eu-central-1
make staging-deploy
```

For local dev, delete or comment out the line in `.env`. Use `/{appname}-prod/`
for production.

Notes:

- Re-running `make {env}-ssm-setup` re-copies a deleted hint from shared SSM
  (`copy_from_shared` only writes when the per-app param is missing). Re-delete
  after a setup re-run if needed.
- The shared `<prefix>/labs-portal/idp-hint=mapp-entra-id` and
  `<prefix>/labs-portal/company-idp-hint=mapp-cloud-company` always point at the
  realm's real IdP aliases (`<prefix>` is `/labs` on staging, `/labs-prod` on
  production).

### How `KEYCLOAK_IDP_HINT` works

When a hint is set, the app adds `kc_idp_hint=<alias>` (e.g.
`kc_idp_hint=mapp-entra-id`) to the authorization request, so the `labs` realm
auto-selects that brokered IdP **for this app only** — no realm-global browser
flow change. This is also the extension point for future UX (an alternate
direct-login button, environment-specific broker choices).

## The session your app receives

NextAuth stays the final session owner; Keycloak sits in front of it. The
internal session shape is unchanged from the pre-Keycloak template:

- `session.user.role`, `email`, `name`
- `session.user.isSuperAdmin` — flat allow-all (`SUPER_ADMINS`)
- `session.user.access` — `'viewer' | 'editor' | 'admin'` (see
  [PERMISSION-LEVELS.md](PERMISSION-LEVELS.md))

Keycloak-backed logins add identity enrichment:

- `session.user.authSource` (`'keycloak'`), `identityProvider`, `keycloakIdpHint`
- `session.user.isMappEmployee`
- `session.user.mappLdapGroups` — raw LDAP group names; check membership for
  fine-grained access (example: `/admin/ldap-groups-example`, gated like
  `/admin/auth-debug` — on outside production, `AUTH_DEBUG_ENABLED=true` in
  production)
- `session.user.workspaces`, `session.user.roles` — company-context flows

Authorization should keep depending primarily on `role`, `isSuperAdmin` and
`access`; treat `mappLdapGroups` as raw identity input unless the app explicitly
maps groups to permissions.

`roles`, `workspaces` and `mappLdapGroups` are **not** stored on the JWT cookie —
they live on the server-side `auth_session` row and are loaded in the session
callback (`src/modules/auth/server/auth-session.ts`). Putting lists on the JWT
gave users with many LDAP groups HTTP 431 on every page. See the pitfalls in
`AGENTS.md`.

### How `isMappEmployee` is derived

`src/modules/auth/config/nextauth.ts` uses three signals, in order of preference:

1. **Explicit `isMappEmployee` claim** from `LabsCompanyContextMapper` (the user
   has a mapp-cloud account flagged as Mapp internal).
2. **Non-empty `mappLdapGroups`** from `LabsLdapGroupsMapper` (the user resolves
   in LDAP under the Mapp domain).
3. **`@mapp.com` email-domain fallback** — catches Entra-only logins where
   neither (1) nor (2) is populated (e.g. LDAP env vars not set on the KC pod, or
   no mapp-cloud SSO context).

So a Mapp employee using **Mapp Entra ID** is always `isMappEmployee=true`, even
without backend enrichment. A customer on **Company Login** (non-`@mapp.com`) is
`false` unless their mapp-cloud roles flag them as internal. Do not narrow this
to one signal — each covers a different gap.

## Architecture notes

### One user per IdP (not per human)

The `labs` realm runs with `loginWithEmailAllowed=false` and
`duplicateEmailsAllowed=true`. If the same human logs in via both buttons, they
get **two distinct Keycloak users** (e.g. `jane.doe@mapp.com` from the Entra path;
`mapp-cloud-company.webtrekk.janed` from Company Login). This is intentional:

- One mapp-cloud email can belong to several mapp-cloud accounts (different
  workspaces, services); merging by email loses information.
- Authorization differs per identity source (Entra = directory/LDAP groups;
  Company Login = mapp-cloud workspace/role membership).

So `/admin/auth-debug` always shows the **identity you just authenticated as**.
Don't expect Mapp Cloud claims after an Entra login (they're empty) or vice versa.

For anyone standing up a `labs` realm by hand rather than from the
`platserv-keycloak` bootstrap JSON (`config/bootstrap/realms/labs-realm.json`,
which sets these and keeps them on re-import), **Realm settings → Login** must be:

| Setting | Required value | Why |
|---|---|---|
| `Login with email` | **OFF** (`loginWithEmailAllowed=false`) | When ON, KC uses email as a username-lookup key, so the broker-flow autolink (`Automatically set existing user`) merges users across IdPs by email. |
| `Duplicate emails` | **ON** (`duplicateEmailsAllowed=true`) | Both paths create a separate user for the same human with the same email. |
| `Email as username` | OFF (default) | Usernames are IdP-prefixed (e.g. `mapp-cloud-company.webtrekk.janed`; raw email for Entra-path users). |

Symptom if these are wrong: clicking one button after a prior login through the
other bypasses authentication and falls through to the existing user, mixing
claims. Fix by toggling the settings and removing the merged user(s).

### The two custom protocol mappers

Two Java SPIs run at token-issue time on the `labs-portal` client, so they fire
whichever button was used:

- **`LabsLdapGroupsMapper`** — looks up `userPrincipalName=<user.email>` in the
  prod LDAP and returns the CN values of `memberOf` as `mappLdapGroups`. Needs
  `AUTH_LDAP_URL/BASEDN/BIND_USER/BIND_PASSWORD` on the KC pod; degrades to empty
  when missing.
- **`LabsCompanyContextMapper`** — calls the Mapp SSO service (REST) with the
  user's `loginName` attribute and returns workspace, role and tenant context.
  Needs `LABS_COMPANY_CONTEXT_SSO_BASE_URL/_BASIC_AUTH_USER/_BASIC_AUTH_PASSWORD`
  on the KC pod; degrades gracefully when missing.

Both are maintained by the platform team in `platserv-keycloak`. Apps only
consume the resulting claims.

## SSM parameters

```bash
make staging-ssm-setup     # or prod-ssm-setup
```

The KC configuration is split between **shared** params (populated once by the
labs-platform team, identical for every Labs app in an environment) and
**per-app** params. `make {env}-ssm-setup` reads the shared params and
auto-copies them into the app's namespace, so you never need to know or type the
client secret.

### Shared namespace convention

| Environment | Shared prefix |
| --- | --- |
| Staging | `/labs/*` |
| Production | `/labs-prod/*` |
| Future envs | `/labs-<env>/*` |

Staging keeps the original env-less `/labs/*` layout for back-compat (do not
migrate it). Production and future envs use the env-suffixed form so the KC
secrets stay isolated per environment. `setup-ssm-params.sh` and
`register-keycloak-uris.sh` pick the prefix from the deploy target.

### Shared parameters (populated once by labs-platform)

| SSM Parameter (staging) | SSM Parameter (production) | Type | Value |
| --- | --- | --- | --- |
| `/labs/labs-portal/issuer` | `/labs-prod/labs-portal/issuer` | String | KC realm issuer URL (`https://idp-int.shortest-route.com/realms/labs` on stg, `https://auth.shortest-route.com/realms/labs` on prod) |
| `/labs/labs-portal/realm` | `/labs-prod/labs-portal/realm` | String | `labs` |
| `/labs/labs-portal/client-id` | `/labs-prod/labs-portal/client-id` | String | `labs-portal` |
| `/labs/labs-portal/client-secret` | `/labs-prod/labs-portal/client-secret` | SecureString | Shared labs-portal OIDC client secret (distinct per env) |
| `/labs/labs-portal/idp-hint` | `/labs-prod/labs-portal/idp-hint` | String | `mapp-entra-id` |
| `/labs/labs-portal/company-idp-hint` | `/labs-prod/labs-portal/company-idp-hint` | String | `mapp-cloud-company` (leave empty to hide the Company Login button) |
| `/labs/labs-portal/tls-insecure` | `/labs-prod/labs-portal/tls-insecure` | String | `true` on stg (temporary INT KC bypass), `false` on prod |

If the setup script reports `SHARED PARAM MISSING`, ask the labs-platform team —
these must exist in the target env before any app deploys. That is outside the
app owner's scope.

To see what's in shared SSM right now (`client-secret` shows as ciphertext unless
you add `--with-decryption`):

```bash
aws ssm get-parameters-by-path --path /labs/labs-portal --recursive \
  --query 'Parameters[*].[Name,Value]' --output table \
  --profile labs-power --region eu-central-1
```

### Per-app parameters (set by `{env}-ssm-setup`)

| SSM Parameter | Required | Purpose |
| --- | --- | --- |
| `/{appName}-stg/NEXTAUTH_SECRET` | Yes | NextAuth secret (auto-generated) |
| `/{appName}-stg/SUPER_ADMINS` | Yes | Comma-separated admin emails for this app |
| `/{appName}-stg/KEYCLOAK_ENABLED` | Yes | `true` to enable Keycloak (default for new apps) |
| `/{appName}-stg/KEYCLOAK_ISSUER` | Yes | Auto-copied from shared |
| `/{appName}-stg/KEYCLOAK_CLIENT_ID` | Yes | Auto-copied from shared |
| `/{appName}-stg/KEYCLOAK_CLIENT_SECRET` | Yes | Auto-copied from shared |
| `/{appName}-stg/KEYCLOAK_IDP_HINT` | Optional | Auto-copied; enables the "Mapp Entra ID" button |
| `/{appName}-stg/KEYCLOAK_COMPANY_IDP_HINT` | Optional | Auto-copied; enables the "Company Login" button |
| `/{appName}-stg/KEYCLOAK_TLS_INSECURE` | Optional | Auto-copied; temporary workaround only |
| `/{appName}-stg/KEYCLOAK_CA_PEM` | Optional | CA bundle, written by `make {env}-keycloak-ca-update` (`unused` placeholder until then) |
| `/{appName}-stg/AZURE_AD_*` | Placeholder | Only used by the legacy direct-Entra path; see below |

Production uses `/{appName}-prod/*`, auto-copied from `/labs-prod/labs-portal/*`.

`KEYCLOAK_ENABLED` is the runtime switch for `/auth/admin`: `true` uses Keycloak
(two buttons), `false` falls back to the legacy direct-Entra path.

**`AZURE_AD_*` placeholders:** the CDK stack references `AZURE_AD_CLIENT_ID`,
`AZURE_AD_CLIENT_SECRET` and `AZURE_AD_TENANT_ID` unconditionally as ECS secrets,
so they must exist even on a Keycloak app (otherwise the task fails with
`ResourceInitializationError: unable to pull secrets`). With Keycloak on,
`{env}-ssm-setup` writes `unused` placeholders (likewise for `KEYCLOAK_CA_PEM`). That does **not** mean the app
uses Azure directly.

## Redirect URI registration on labs-portal

All Labs apps share one OIDC client (`labs-portal`) in the `labs` realm. For
Keycloak to accept the app's callback, its hostname must be registered there.

**This happens automatically** as the last step of `make staging-first-deploy`
(step 7/7) and `make staging-deploy` (step 4/4) — and the `prod-*` equivalents.
`scripts/deploy/register-keycloak-uris.sh`:

1. reads the hostname the stack actually deployed under — the `NEXTAUTH_URL` env
   var on the running ECS task definition of `{appName}-{stg|prod}`;
2. gets a token for the dedicated `labs-portal-registrar` service account, whose
   credentials it reads from **shared** SSM on the deployer's machine;
3. adds whichever of these three entries are missing on `labs-portal`:
   - `https://{host}/api/auth/callback/keycloak` → Valid redirect URIs
   - `https://{host}/auth/signout*` → Valid post logout redirect URIs
   - `https://{host}` → Web origins

It is idempotent (a second run prints `no changes — all entries already present`)
and retries up to 3 times, which covers transient errors and two deploys racing.
If it still fails, the deploy itself **succeeds** but logins return
`Invalid redirect URI` until you re-run it:

```bash
bash scripts/deploy/register-keycloak-uris.sh staging    # or production
# Override the ECS lookup with a hostname (no scheme/path):
APP_HOST=stg-myapp.labs.mapp.com bash scripts/deploy/register-keycloak-uris.sh staging
```

> **VPN required.** The script reaches the Keycloak admin API at an internally
> routed hostname (e.g. `auth-admin.deproxy.muc.domeus.com` on prod; staging's
> INT host likewise). Without Mapp VPN you hit the public OIDC host and get
> `HTTP status: 404` with an nginx body. Connect and re-run.

### "My app's SSM only has the client secret — how do I register my URI?"

**You don't — the deploy does it.** This is the most common false blocker. The
app's namespace (`/{appName}-stg/*`) intentionally holds **only** the `labs-portal`
client secret and **no** admin-capable credential: the container must never hold
something that can modify the shared client. The registration script runs on
**your machine** and reads its own credentials from shared SSM:

| Environment | Registrar credentials |
|---|---|
| staging | `/labs/kc-registrar/{client-id,client-secret,base-url}` |
| production | `/labs-prod/kc-registrar/{client-id,client-secret,base-url}` |

So do not wait on the labs-platform team, and do not gate `KEYCLOAK_ENABLED=true`
on any external confirmation.

The service account has only `manage-clients` on the `labs` realm, and the script
touches only the `labs-portal` client — it cannot create users, change auth flows
or reach other realms.

> **Retrofitted apps:** an app forked before Keycloak support and retrofitted via
> `docs/retrofit/2026-06-10-keycloak-*` may be missing the step (earlier revisions
> of those guides omitted it). Check with `grep -rn "register-keycloak-uris"
> scripts/deploy/`; if nothing matches, copy the script from the template and wire
> it into the app's deploy script. No new credentials are needed.

### Local development ports

`labs-portal` has `http://localhost:3000`, `:3001` and `:3002` pre-registered.
Next.js falls back to 3001/3002 when 3000 is busy, and `NEXTAUTH_URL` must match
the port actually used (a mismatch makes auth redirects 404).

The registration script always registers `https://` URIs (it is built for
deployed hostnames), so it cannot add another `http://localhost` port. Free one
of the three ports instead, or ask the labs-platform team to register an extra
one.

### When registration fails

| Symptom | Cause | Fix |
|---|---|---|
| `HTTP status: 404` + nginx HTML body | Not on Mapp VPN | Connect to Mapp VPN, re-run |
| `ERROR: 'jq' is required but not installed` | `jq` missing | `brew install jq` / `apt-get install jq` / `winget install jqlang.jq` |
| `ERROR: NEXTAUTH_URL is not set on the running task definition` | Stack deployed from an older template without `NEXTAUTH_URL`, or the ECS service isn't named `{appName}-{stg\|prod}` | Re-run with `APP_HOST=<host>` |
| HTTP `000` on Windows | curl (Schannel) doesn't trust the internal CA — fixed in the script | Update the script from the template; see [WINDOWS.md](WINDOWS.md) |
| Shared `/labs/kc-registrar/*` missing, or token request returns `401 invalid_client` | Registrar credentials absent or rotated | **Escalate to labs-platform** ([platform/KEYCLOAK-REGISTRAR-SETUP.md](platform/KEYCLOAK-REGISTRAR-SETUP.md)) |
| `403 Forbidden` from the clients endpoint | Service account lost `manage-clients` | Escalate to labs-platform |

## TLS and the CA bundle

Backchannel KC calls (token / userinfo / jwks) use a Node HTTPS agent that
**merges** Mozilla's default root store with whatever is in `KEYCLOAK_CA_PEM`.
Node's `https.Agent({ ca })` would normally *replace* the default store, breaking
chains that end at a public root (e.g. `DigiCert Global Root G3`); the merge
(`tls.rootCertificates`) lives in `src/modules/auth/config/nextauth.ts`. So store
only the intermediate(s) in `KEYCLOAK_CA_PEM`.

> **Before reaching for `KEYCLOAK_CA_PEM`:** if the Keycloak ingress cert chains
> to the Mapp **internal root CA** (`ca.internal.mapp.tools`), you need nothing
> here — that root is vendored in the image and trusted automatically.
> `KEYCLOAK_CA_PEM` is only for a Keycloak host whose cert is **not** under the
> internal root. See [INTERNAL-CA.md](./INTERNAL-CA.md).

Don't paste multiline PEM into the interactive SSM prompt. Use:

```bash
make staging-keycloak-ca-update     # or prod-keycloak-ca-update
```

It reads `KEYCLOAK_ISSUER`, fetches the presented chain with `openssl s_client`
(following AIA URLs for missing intermediates), and stores the non-leaf bundle in
`/{appName}-{stg|prod}/KEYCLOAK_CA_PEM`. Never commit environment-specific
certificates to git.

### Emergency bypass: `KEYCLOAK_TLS_INSECURE=true`

Disables TLS validation on the backchannel entirely. Use it only when the public
OIDC endpoints are reachable, the callback fails with
`UNABLE_TO_GET_ISSUER_CERT_LOCALLY` / `UNABLE_TO_GET_ISSUER_CERT`, and you need a
working deploy before the CA chain can be populated. Recovery:

1. `make {env}-keycloak-ca-update`
2. set `KEYCLOAK_TLS_INSECURE=false` (in shared SSM, then re-run `{env}-ssm-setup`)
3. redeploy

**Current state:** prod runs `false` with the full chain (intermediate
`RapidSSL TLS ECC CA G1` in the bundle, root from the Mozilla store). Staging may
still be `true` as a transitional value (`.env.example` ships `true` for local
dev against INT); flipping it to `false` is the goal. Both values are curated by
labs-platform in shared SSM — if an app suddenly fails with
`UNABLE_TO_GET_ISSUER_CERT` after a redeploy, the shared chain probably went
stale; tell labs-platform.

### Public OIDC endpoints

If a Keycloak discovery document advertises internal ingress URLs for token,
userinfo or jwks, the app can override them to the public issuer host — the
provider configuration supports this. The proper fix is still to correct
Keycloak's discovery/frontend configuration.

## Validation after a deploy

1. `/auth/admin` starts the Keycloak flow and both (or your one) buttons appear.
2. Each button completes the round trip: Mapp Entra ID → `/admin`, Company Login →
   the customer area.
3. `/admin/auth-debug` (on by default outside production; set
   `AUTH_DEBUG_ENABLED=true` to enable it — and `/admin/ldap-groups-example` — in
   production; admin-only) shows
   `authSource = "keycloak"`, `identityProvider`, `keycloakIdpHint` and
   `mappLdapGroups`.

`mappLdapGroups` can be empty where the LDAP mapper isn't configured on the KC
pod; login still works.

## Troubleshooting

**Local: "Invalid redirect_uri" on a login button.** The dev server is on a port
other than 3000–3002 (often because 3000 was busy). Free a pre-registered port and
fix `NEXTAUTH_URL` — see [Local development ports](#local-development-ports).

**Deployed: "Invalid redirect URI".** The post-deploy registration didn't run or
failed — re-run `bash scripts/deploy/register-keycloak-uris.sh staging` (on VPN).

**Logout doesn't end the Keycloak session** (the next login passes straight
through). Two known causes, both fixed in the template — check old forks:

- `src/app/auth/signout/page.tsx` must have `export const dynamic = 'force-dynamic'`.
  Without it Next.js prerenders the page at Docker build time with the build-stage
  `KEYCLOAK_ENABLED=false`, freezing it to local-only signout.
- It must pass next-auth's `getToken()` the cookie **store**
  (`req: { cookies: await cookies(), headers: {} }`), not a raw `Cookie` header —
  otherwise `getToken()` returns `null` and Keycloak logout is silently skipped.

**"Account already exists" page after an Entra login.** The same identity logged
in through the other button first; the realm holds one user per IdP by design and
autolink handles the normal case, but manually deleted upstream users can leave an
inconsistent state. Use the button you used first, or ask labs-platform to clean
up the federated identity links for your user.

**`SHARED PARAM MISSING: /labs/labs-portal/...` from `{env}-ssm-setup`.** The shared
params aren't populated for that environment — a one-time labs-platform task.

**Local TLS/SSL handshake errors against INT Keycloak.** INT's chain is
incomplete; keep `KEYCLOAK_TLS_INSECURE=true` in the local `.env` (as shipped in
`.env.example`).

**HTTP 431 on every page.** The session cookie grew too large — something put a
list on the NextAuth JWT. See the pitfall in `AGENTS.md`.

More, not auth-specific: [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Glossary

- **`labs` realm** — the front-door Keycloak realm. All Labs apps authenticate
  against it.
- **`labs-portal`** — the shared OIDC client in the `labs` realm. Every Labs app
  uses the same client id + secret; an app's identity is its redirect URI.
- **`mapp-entra-id`** — IdP alias in `labs` that brokers to Entra (via saml-sp).
- **`mapp-cloud-company`** — IdP alias that brokers to the mapp-cloud realm
  (customers).
- **`labs-portal-registrar`** — service account in `labs` with `manage-clients`;
  used only by `register-keycloak-uris.sh`.
- **`/labs/labs-portal/*`** (`/labs-prod/...` on prod) — shared SSM: issuer, realm,
  client id/secret, IdP hints, tls-insecure. Same for every Labs app.
- **`/labs/kc-registrar/*`** (`/labs-prod/...`) — shared SSM for the registrar
  service account, read by the deploy.
- **`/{appName}-stg/*`**, **`/{appName}-prod/*`** — the app's own SSM namespace,
  populated by `make {env}-ssm-setup`.
