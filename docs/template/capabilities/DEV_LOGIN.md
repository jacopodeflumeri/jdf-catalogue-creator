# Dev Login Bypass

Local-only mock login so you can develop **without AWS or Keycloak**. It mocks
only the identity — the real `signIn` hydration + eligibility code still runs, so
you can exercise the full admin / company-customer / eligibility matrix offline.

## Enabling

Set in `.env` (local only):

```
DEV_AUTH_ENABLED=true
```

**Double-gated:** honored only when `DEV_AUTH_ENABLED=true` **and**
`NODE_ENV !== 'production'`. The `dev-login` NextAuth provider is never registered
in a production build, and `/auth/dev` returns 404 in production.

## Using it

Visit **`/auth/dev`**, choose **admin** or **customer**, fill in the fields, and
sign in:

- **admin** → routed through `hydrateInternalAdminUser` (first user becomes
  active/admin, see the access model in `COMPANY_LOGIN.md`).
- **customer** → routed through `hydrateCompanyUser` with the company id /
  workspace `services` you enter (so an app's `CustomerEligibilityPolicy` has
  something to read). Rejected if the Company Login capability is disabled
  (`COMPANY_LOGIN_ENABLED=false`).

While the flag is on, `/auth/admin` shows a **Developer login (local only)**
link. Like the real login buttons, the dev login honours `?callbackUrl=` (the
page that sent you to sign in), so it lands back where you were — when that page
is in the chosen role's area (`/account` or `/admin`) and same-origin; otherwise
on the area root. See `src/modules/auth/lib/callback-url.ts`.

## Footgun

`NEXTAUTH_URL` must match the dev port. Next falls back to 3001/3002 when 3000 is
busy; a mismatched `NEXTAUTH_URL` makes auth redirects 404.

## Files

- `src/app/auth/dev/page.tsx` + `DevLoginClient.tsx`
- `dev-login` CredentialsProvider in `src/modules/auth/config/nextauth.ts`
- `config.devAuth.enabled` (`src/config/index.ts`)
