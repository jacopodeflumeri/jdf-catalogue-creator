# Customer Preview ("View as customer")

**Type:** Optional (off by default)
**Module:** `src/modules/customer_preview/` · **End route:** `/admin/customer-preview/end`
**Dependencies:** `company_login` (required) · `client_catalog` (recommended)

## Overview

An admin-level Mapp user opens a company's customer pages (`/account/*`) **exactly
as that company's Company-Login customers see them** — read-only, for 30 minutes,
bound to that admin, and recorded in the audit log. For a company with several
workspaces the admin can preview the whole company or a single workspace, the
way a customer granted only that workspace would see it.

It works by substitution, not by imitation: a signed cookie makes
`requireCustomer` return a **synthesized Company-Login customer session** for the
company. Everything downstream — `getCustomerPageScope`, the eligibility policy,
`resolveCompanyContext`, the customer layout, your pages — runs unchanged against
it. That is what makes the preview faithful, and why enabling it needs no
changes to your customer pages.

Every decision below is already made and encoded in code and tests. Enabling the
capability means: set two env vars, check the subject seam, and follow the
**read-only rule** for any customer mutation you write.

## When to enable it

- Support or account managers need to see what a customer sees ("why is their
  dashboard empty?").
- You want to check a company's onboarding / eligibility outcome before telling
  them they're live.
- Demos of a real customer's view without borrowing their login.

Leave it off for Mapp-internal-only apps (`COMPANY_LOGIN_ENABLED=false` turns it
off regardless).

## Enabling it

1. `.env` (and the ECS task definition `environment` in `infra/lib/stack.ts` for
   staging/production — they are not secrets):

   ```bash
   CUSTOMER_PREVIEW_ENABLED=true
   # The workspace service codes your eligibility policy checks — see below.
   CUSTOMER_PREVIEW_SERVICES=
   ```

2. **Service codes.** A real customer's session carries
   `workspaces[].services` from their Keycloak claim. The preview has no claim, so
   it grants `CUSTOMER_PREVIEW_SERVICES` on every workspace. Set it to the
   code(s) your `customerEligibilityPolicy`
   (`src/modules/auth/server/customer-eligibility.ts`) requires — Keycloak claim
   codes, **not** the client catalog's product names (`INTELLIGENCE`, `FASHION`,
   …). Empty is right only with the template's allow-all policy. Get it wrong and
   every preview lands on `/account/get-started` — which is at least visible.

3. **The subject seam** (`src/modules/customer_preview/config/subject.ts`) — see
   next section. The default works out of the box when `client_catalog` is
   configured.

4. Add `"customer_preview"` to `app.config.json` `enabledCapabilities`.

5. Nothing else: no schema change, no new secret (the token is signed with
   `NEXTAUTH_SECRET`), and the launch points appear by themselves for admins.

## The seam: `resolvePreviewSubject(companyId)`

The one function an app may need to implement. Given a client-catalog company id
it returns what a customer of that company logs in with, or `null`:

```ts
interface PreviewSubject {
  companyId: number;              // client-catalog company id
  accountId: number | null;       // MUST equal resolveAccountIdForCompany(companyId)
  name: string;
  workspaces: { id: number; name: string; services?: string[] }[]; // client-catalog ids
  services: string[];             // granted on every workspace without its own
}
```

| Template default | When |
|---|---|
| The company and its workspaces from the Company Management Service; `accountId` via `resolveAccountIdForCompany`; inactive company → `null` | `CLIENT_CATALOG_BASE_URL` is set |
| A **stub** from `company_user`: a company is previewable once one of its users has logged in, with **no workspaces** | otherwise |

Override it when your app keeps companies/workspaces locally (e.g. after
installing the client_catalog scaffold) — the file's header has the exact code.
Rules:

- It is called on **every request** during a preview (memoized per request and
  for 60 s across requests — `server/subject-cache.ts`; your override gets that
  for free). Keep it a cheap, side-effect-free read.
- `accountId` must be what a real login of the company resolves, or the preview
  shows a different company context than the customer gets.
- Workspace ids are **client-catalog** workspace ids — the `workspaceId` a real
  session carries — not local primary keys.
- Per-workspace `services` override the subject-level list when entitlements
  differ by workspace.

## Launch points

Shipped:

- **`/admin/company-users`** — one "View as customer" per company (on the first
  of its rows); its workspaces are loaded when clicked.
- **client_catalog scaffold, company page** (`app/companies/[companyId]/page.tsx.example`)
  — with the company's workspaces at hand.

One workspace → a plain button (whole company). Two or more → a chooser:
**Whole company** or **"<workspace> only"**. Hidden — not disabled — for anyone
below admin access level and while the capability is off.

Adding one is one component and one action:

```tsx
// In a server component — renders nothing unless allowed:
import { CustomerPreviewLaunch } from "@/modules/customer_preview/server";
<CustomerPreviewLaunch companyId={id} companyName={name} workspaces={[{ id, name }]} />

// In a client component — compute `allowed` on the server and pass it down:
//   page.tsx:  canStartCustomerPreview(session)   (from …/customer_preview/server)
import { CustomerPreviewLauncher } from "@/modules/customer_preview/client";
<CustomerPreviewLauncher allowed={canPreview} companyId={id} />   // workspaces optional
```

Both call `startCustomerPreviewAction({ companyId, workspaceIds?, returnTo })`.
The preview returns to the page it was started from, so put
`<CustomerPreviewNotice status={searchParams.preview} />` on that page (it shows
"stopped viewing", "preview ended", "not found", …).

## Lifecycle

1. **Start** — `startCustomerPreviewAction` (`requireAdmin({ requireAdminAccess: true })`,
   which also admits SuperAdmins): refuses when the capability is off; resolves
   the company **fresh** through the seam; validates `workspaceIds` (positive
   integer numbers, no duplicates, every one a workspace of this company —
   anything else is **refused**, never dropped, coerced or trimmed); sets the
   cookie; writes `customer_preview_start`; redirects to `/account`.
2. **During** — the overlay in `getCustomerRequestSession`
   (`src/modules/auth/server/require-auth.ts`) turns admin session + valid cookie
   into the customer session, once per request.
3. **End** — `GET /admin/customer-preview/end` (the banner's Exit, the layout's
   "Exit preview", or an automatic redirect when the cookie stops verifying):
   clears the cookie, writes `customer_preview_end` **only** for this admin's own
   unexpired preview, and returns to the launching page with
   `?preview=exited|ended|unavailable` (default `/admin/company-users`).

## Security invariants (all tested)

| Invariant | Where |
|---|---|
| Token: `base64url(json).base64url(HMAC-SHA256)` keyed with `NEXTAUTH_SECRET`, `{v, adminEmail, subject, exp, workspaceIds?, returnTo?}`; compared with `timingSafeEqual`; verification never throws | `lib/token.ts` |
| Cookie `labs_customer_preview`: httpOnly, SameSite=Lax, Secure in production, path `/`; token lives 30 min, the cookie 10 min longer so expiry is *noticed* (the admin gets "ended" instead of a sign-in error) | `server/actions.ts`, `lib/constants.ts` |
| Only admin access level or SuperAdmin, `accessStatus` active, passing requireAdmin's IP allow-list / superadmin-only checks — re-checked on **every** request, so losing access ends the preview | `server/resolve.ts`, `require-auth.ts` |
| Bound to the admin: `adminEmail` must equal the live session's email | `server/resolve.ts` |
| Expired, forged, someone else's cookie, lost access → redirected to the end route (`reason=ended`); company gone or seam error → `reason=unavailable` | `require-auth.ts` |
| The synthesized session has **no admin powers**: no `access`, `accessStatus`, `adminId`; `isSuperAdmin: false`; no `userId` (nothing resolves a `CompanyUser`); built field by field, nothing of the admin's spread in except display name/email/image | `buildCustomerPreviewSession` |
| Workspaces = chosen ∩ the company's **current** workspaces: narrows, never widens; a stale or foreign id grants nothing | `server/resolve.ts` |
| Capability off → overlay is skipped without reading the cookie; start refuses; the end route still clears a stale cookie | `resolve.ts`, `actions.ts`, `end-route.ts` |
| No cookie (the normal case) → no database or network work at all; the seam is even loaded lazily | `resolve.ts`, `subject-cache.ts` |
| Proxy: an admin carrying the cookie may enter `/account` **pages** (presence check only; verification is server-side). Not `/api/account/*` | `allowsCustomerArea` in `lib/constants.ts` |
| End route: **relative** `Location` (behind the load balancer `request.url` is the container's own address); `returnTo` re-sanitised to an `/admin` path, and only taken from the admin's own cookie | `server/end-route.ts` |
| Usage attribution during a preview goes to the **admin** (`userId`), never the company | `resolveUsageAttribution` |
| Audit: `customer_preview_start` / `customer_preview_end`, entity type `company`, actor via `sessionAuditActor` | `actions.ts`, `end-route.ts` |

## The read-only rule (read this if you write customer code)

> **Every customer mutation calls `assertNotPreview(session)` before it writes.**

```ts
"use server";
import { requireCustomer } from "@/modules/auth/server";
import { assertNotPreview } from "@/modules/customer_preview";

export async function renameReport(id: number, name: string) {
  const session = await requireCustomer();
  assertNotPreview(session); // throws CustomerPreviewReadOnlyError during a preview
  // … write …
}
```

Or, to return your own error shape: `if (isPreviewSession(session)) return { ok: false, error: CUSTOMER_PREVIEW_READ_ONLY_MESSAGE };`.
"Mutation" means anything a customer action writes or triggers: DB writes,
emails, magic links, API keys, uploads, activity rows, calls that change
another system, metered usage. All template customer mutations already do it
(`account-actions.ts`, `account-profile-actions.ts`, `activity-actions.ts` —
pinned by `src/lib/actions/account/__tests__/customer-preview-readonly.test.ts`).

**The central safety net.** During a preview, `requireCustomer` refuses **every
server-action request** (it throws `CustomerPreviewReadOnlyError`) unless the
action declares itself read-only:

```ts
const session = await requireCustomer({ readOnly: true });          // a read invoked from the client
const scope = await getCustomerPageScope({ readOnly: true });       // same, via the page scope
```

Pages, layouts and anything called while rendering are not affected. So a
forgotten `assertNotPreview` in a server action is still safe; the explicit
check is what covers route handlers and code paths that aren't server actions,
and gives users a readable message. **Never** pass `readOnly: true` on an action
that writes.

In the UI, hide mutation controls during a preview (hide, don't disable — same
rule as viewers): `isPreviewSession(session)` with the server session.

## Limitations (by design — know them before you rely on a preview)

- **The browser's `useSession()` is still the admin.** Only the server session is
  the customer. Customer layouts and nav must decide from the session passed
  down from `requireCustomer` (`CompanyCustomerLayout` and `CustomerLayoutClient`
  already do). A client component that branches on `useSession()` shows the
  admin's view.
- **It can't reproduce one real customer's exact grant.** A real session may
  cover fewer workspaces than the company has, and its service codes come from
  Keycloak, which the preview can't see. The workspace chooser covers the common
  "only one workspace" case; `CUSTOMER_PREVIEW_SERVICES` stands in for the codes.
  A company that previews fine can still have a customer who hits the
  eligibility page.
- **Customer API routes (`/api/account/*`) don't get the overlay** — they see the
  admin's real session and return 401. Load customer data server-side or with
  a server action (`readOnly: true` if invoked from the client).
- **Only the company-customer path.** The preview session is always a
  Company-Login customer, so it renders `CompanyCustomerLayout`; legacy
  magic-link account pages (`CustomerLayoutClient`) are not previewed.
- **One preview per browser.** Starting another replaces the current one.
- **Sign out is replaced by "Exit preview"** in the company-customer header:
  signing out there would sign the *admin* out.

## Pitfalls (each one has bitten an implementation)

1. **Formatting the end time during render** → hydration mismatch on every preview
   page (server UTC vs browser zone). The banner's time is a client-only island
   (`PreviewEndTime`, `useSyncExternalStore` with a `null` server snapshot). Don't
   "simplify" it.
2. **An absolute redirect built from `request.url`** in the end route sends admins
   to `https://0.0.0.0:3000/…` in production. Keep the relative `Location`.
3. **`<Link>` to the end route** tries to fetch a route handler as a page. Use a
   plain `<a>`.
4. **Deciding layout/nav from `useSession()`** shows the admin's chrome around
   the customer's content.
5. **A service code that doesn't match the eligibility policy** → every preview
   lands on `/account/get-started`. Set `CUSTOMER_PREVIEW_SERVICES`.
6. **Seam `accountId` ≠ `resolveAccountIdForCompany`** → the preview resolves a
   different company context than the customer.
7. **Spreading the admin's `session.user` into the preview session** leaks admin
   powers (`access`, `adminId`, `isSuperAdmin`) into customer code. Build it field
   by field (`buildCustomerPreviewSession`).
8. **A read-only server action that calls `revalidatePath`** re-renders the page
   inside the action request, where the layout's `requireCustomer` is refused
   during a preview. Reads don't revalidate.
9. **Dropping unknown workspace ids instead of refusing** silently widens "X only"
   to something else. The start action refuses the whole request.

## Relation to the legacy "view account" page

`/auth/admin-view-account?accountId=…` (+ `adminViewAsAccount`, the sidebar
`AdminImpersonationBanner`) is the older, **account-only** admin view for legacy
magic-link apps: it writes an `accountId` onto the admin's own JWT and shows the
legacy account pages. It is kept, unchanged, for those apps. For Company-Login
apps, **`customer_preview` supersedes it**: it reproduces the company-customer
session (company, workspaces, eligibility), is read-only, expires, and is
audited. The two don't interact — a preview cookie takes precedence while it is
valid.

## Module API

| Import | What |
|---|---|
| `@/modules/customer_preview` | `assertNotPreview`, `isPreviewSession`, `CustomerPreviewReadOnlyError`, `CUSTOMER_PREVIEW_*` constants, `withPreviewStatus`, `sanitizePreviewReturnTo`, `formatPreviewEndTime` (pure; safe in any server action) |
| `@/modules/customer_preview/client` | `CustomerPreviewLauncher`, `CustomerPreviewBanner`, `CustomerPreviewNotice` |
| `@/modules/customer_preview/server` | `CustomerPreviewLaunch`, `canStartCustomerPreview`, `canPreviewAsCustomer`, `isCustomerPreviewEnabled`, `startCustomerPreviewAction`, `getCustomerPreviewOptionsAction`, `resolvePreviewSubject`, `clearPreviewSubjectCache`, token helpers |

`session.user.customerPreview` (`CustomerPreviewSessionInfo` in
`src/modules/auth/types`) is set only on preview sessions:
`{ adminEmail, adminMappUserId, companyId, companyName, expiresAt, workspaceNames? }`.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `CUSTOMER_PREVIEW_ENABLED` | Yes | `true` turns the capability on. Ignored (off) when `COMPANY_LOGIN_ENABLED=false` |
| `CUSTOMER_PREVIEW_SERVICES` | Usually | Comma-separated workspace service codes granted during a preview — the codes your eligibility policy checks |

## Database schema changes

None. Audit rows use the standard `audit_log` table with entity type `company`.

## Testing

- Unit (`make dev-test-unit`): `src/modules/customer_preview/__tests__/*`
  (token, overlay incl. narrowing / never widening / other admin / expired /
  forged / lost access / missing subject / capability off, start action incl.
  partial and foreign ids, launcher, banner hydration), the end route
  (`src/app/admin/customer-preview/end/__tests__`), `require-auth-preview.test.ts`
  (overlay + central read-only guard), the template mutations' read-only test,
  and `CompanyCustomerLayout.test.tsx`.
- By hand, locally: `DEV_AUTH_ENABLED=true` + `CUSTOMER_PREVIEW_ENABLED=true`, sign
  in at `/auth/dev` once as a **customer** (so a `company_user` row exists for
  the company — the stub seam needs it), then as an **admin**, open
  `/admin/company-users`, press **View as customer**, check the banner, then
  **Exit**. The dev admin is a SuperAdmin only if its email is in `SUPER_ADMINS`
  (or it is the first Mapp user, who becomes `admin`).
- When you add a customer mutation, add it to the read-only test.
