# Company Login (Keycloak / Mapp Cloud)

Keycloak-brokered authentication with a **company-context customer path**, built
into the template's auth module (`src/modules/auth`). NextAuth stays the session
owner; Keycloak is the upstream broker.

One Keycloak provider, two IdP hints:

- **Mapp Entra ID** (`KEYCLOAK_IDP_HINT=mapp-entra-id`) → internal Mapp admins,
  mapped onto the local `MappTeam` access model.
- **Company Login** (`KEYCLOAK_COMPANY_IDP_HINT=mapp-cloud-company`) → Mapp Cloud
  customers. Their session is enriched **on login** with `companyId`, `tenantId`,
  `roles[]`, and `workspaces[].services[]`, and persisted to a `CompanyUser` row
  so usage/spend can be attributed even outside a live session.

## Internal-only vs external company users (the capability switch)

This is a real, toggleable capability — listed in `app.config.json`
`enabledCapabilities` and gated at runtime by `config.companyLogin.enabled`
(env `COMPANY_LOGIN_ENABLED`, **default ON**). Decide up front what you're
building:

- **App for external company-context users (default).** Leave it on. Mapp Cloud
  customers can log in with company context; the admin Company Users views show;
  `CompanyUser` rows are persisted.
- **App JUST for Mapp internal folks.** Set `COMPANY_LOGIN_ENABLED=false` (and
  drop `company_login` from `enabledCapabilities`). The company-context CUSTOMER
  `signIn` path is **refused** (fail-closed — never falls through to an admin
  row), and the admin Company Users views (settings card, `/admin/company-users`,
  `/admin/accounts/[id]/users`) 404. Internal Mapp admins (Entra) are unaffected.

The internal-admin path (Mapp Entra ID) is always available regardless of this
switch — it's the customer/company side that the switch turns off.

## The three auth layers

Keep these separate — it's what lets the template stay generic:

1. **Identity** (generic): who the user is — `companyId`, `workspaces[].services`,
   `authSource`, `identityProvider`. Extracted by the pure helpers in
   `config/keycloak/claims.ts`.
2. **Authorization** (generic): what they may do — `role` / `isSuperAdmin` /
   `access` (viewer/editor/admin).
3. **App eligibility / entitlement** (APP-SPECIFIC, pluggable): can this customer
   meaningfully use *this* app at all? See the eligibility seam below.

## Fail-closed login routing

`signIn` forks by **how** the user logged in, never by email domain:

- `identityProvider === 'mapp-cloud'` → **always a customer** (even with an
  `@mapp.com` email — test/company accounts often are).
- `identityProvider === 'entra'` → internal admin.
- `identityProvider === 'internal'` (the unknown/default bucket) → internal admin
  **only** when corroborated by non-empty `mappLdapGroups`; otherwise treated as a
  customer.

This fails closed: ambiguous identities get the *less*-privileged customer path,
never an admin row.

## Security posture

- The Keycloak `id_token` is **server-side only** — stored on the login's
  `auth_session` row, never copied onto `session.user`, so it is not exposed to
  client JS via `/api/auth/session`. The federated-logout page (`/auth/signout`)
  reads it from that row, via the `authSessionId` on the JWT.
- **The session cookie holds scalars only.** `roles`, `workspaces` and
  `mappLdapGroups` are stored on the same `auth_session` row and put back on
  `session.user` by the session callback, so callers read them exactly as
  before. They must not go on the JWT: the JWT *is* the cookie, it is sent on
  every request, and a user with enough LDAP groups exceeds Node's 16 KB
  request-header limit and gets **HTTP 431 on every page**. See
  `src/modules/auth/server/auth-session.ts`.
- **TLS-insecure is hard-gated off in production**: `config.keycloak.tlsInsecure`
  is forced `false` when `NODE_ENV === 'production'`, so a real cert + CA bundle
  is mandatory there.
- `SUPER_ADMINS` is resolved from env + the verified OIDC id_token email only
  (never client-spoofable). The only arbitrary-identity path is the dev bypass,
  which is double-gated to non-production.
- The CA-bundle HTTPS agent **merges** the Mozilla root store with any custom CA
  (passing `ca` to `https.Agent` would otherwise replace the default trust store).

## The two app-specific seams

The template ships generic defaults; apps override these — and nothing else — to
plug in their own company model and entitlement rules.

### 1. Company → local Account mapping

`src/modules/auth/server/company-account-resolver.ts`

```ts
export async function resolveAccountIdForCompany(companyId: number): Promise<number | null>
```

Template default returns `null` (the base schema has no company→account mapping,
so a `CompanyUser` is stored unlinked — still fully usable for identity +
attribution). An app that maps companies to accounts overrides this, e.g.:

```ts
const account = await prisma.account.findUnique({
  where: { clientCatalogCompanyId: companyId },
  select: { id: true },
});
return account?.id ?? null;
```

### 2. Customer eligibility policy

`src/modules/auth/server/customer-eligibility.ts`

```ts
export interface CustomerEligibilityPolicy {
  evaluate(session): Promise<CustomerEligibility> | CustomerEligibility; // { eligible, reason?, ctaHref?, ctaLabel? }
}
```

Template default is **allow-all**. The gate lives at the content layer
(`requireEligibleCustomer()`), not in `signIn` — an ineligible customer still
authenticates and is redirected to `/account/get-started`. Apps override the
policy (e.g. require a specific `services` entitlement, or a provisioned feed).
The policy is memoized per request (React `cache`), so it must be a pure read.

Customer pages start with **`requireEligibleCustomerPageScope()`** (or
`getCustomerPageScope()` where eligibility is checked by hand, e.g. the
onboarding page), from `src/modules/auth/server/customer-page-scope.ts`. It
returns `{ session, isCompanyCustomer, eligibility, context }`: the session is
read once, the eligibility check and the company-context lookup run in parallel,
and the result is memoized for the rest of the request — so the layout, the page
and any server action it awaits never repeat those lookups. Narrow `context`
further in the app (e.g. by a URL filter) rather than adding parameters to it.

## Access model (no pending/approval)

The first Mapp user ever to log in becomes **active/admin** (bootstrap);
everyone after is **active/viewer**. `suspended`/`denied` remain for moderation;
`SUPER_ADMINS` is the break-glass override. `MappTeam.accessStatus` defaults to
`active`. `accessStatus` is refreshed per request in the JWT callback and carried
on the session, so `require-auth` enforces it without a second DB read.

## Admin views

Built-by-default for company-capable apps (those with
`KEYCLOAK_COMPANY_IDP_HINT` set):

- **Company Users** card on `/admin/settings` → `/admin/company-users`
  (server-paginated + searchable across the whole customer base).
- Per-account list at `/admin/accounts/[id]/users` (populated once an app wires
  `resolveAccountIdForCompany`).
- Optional **View as customer** (`customer_preview`, off by default): admins
  preview a company's customer pages through a synthesized session substituted
  in `requireCustomer`. See [CUSTOMER_PREVIEW.md](CUSTOMER_PREVIEW.md).

## Usage attribution

`resolveUsageAttribution(session, { workspaceId? })` returns
`{ userId | companyUserId, companyId, workspaceId }` — exactly one of `userId`
(MappTeam) / `companyUserId` (CompanyUser) is set. Apps that ship a metering/LLM
capability add nullable `companyUserId` / `companyId` / `workspaceId` columns
(onDelete `SetNull`) to their usage tables and pass this result into their
create/record calls.

## Local development without AWS

Set `DEV_AUTH_ENABLED=true` (non-production only) to use `/auth/dev` — a mock IdP
that runs the **real** hydration + eligibility code, so you can exercise the full
admin/customer/eligibility matrix offline. `NEXTAUTH_URL` must match the dev port
(Next falls back to 3001/3002 if 3000 is busy → auth redirects 404). To test the
real INT Keycloak instead, set `KEYCLOAK_ENABLED=true` + the `/labs/labs-portal/*`
issuer/client/secret/hints; ports 3000–3002 are pre-registered.

## Env vars

See `.env.example`. Key ones: `KEYCLOAK_ENABLED`, `KEYCLOAK_ISSUER` (realm is
embedded in the issuer path — no separate `KEYCLOAK_REALM`), `KEYCLOAK_CLIENT_ID`,
`KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_IDP_HINT`, `KEYCLOAK_COMPANY_IDP_HINT`,
`KEYCLOAK_CA_PEM`, `KEYCLOAK_TLS_INSECURE`, `DEV_AUTH_ENABLED`,
`AUTH_DEBUG_ENABLED`, `MAGIC_LINK_ENABLED`.

## Magic-link (optional, off by default)

The legacy email magic-link customer path is preserved as an optional capability
behind `MAGIC_LINK_ENABLED` (default `false`), cleanly decoupled from the Keycloak
path. Apps with non-company users can enable it; most apps use Company Login only.
The `MagicLink` table + `prismaService.auth` remain as the rebuild seam.
The email itself is sent through Mapp Engage (`src/modules/mapp_engage`); a starting
HTML template for the Engage message is in
[private/email/magic-link.html](../../../private/email/magic-link.html).
