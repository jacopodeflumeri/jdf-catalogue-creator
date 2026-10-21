# Retrofit prompt — Keep the session cookie small (fixes HTTP 431)

> Implements the **2026-10-09 "Session cookie no longer grows with the user's profile"**
> entry in [`MIGRATION.md`](../../MIGRATION.md).
>
> **Applies to every fork with Keycloak login.** Users with many LDAP groups or
> workspaces get **HTTP 431 on every page**, because their roles, workspaces, groups and
> the Keycloak `id_token` were all stored in the session cookie. This moves them to a new
> `auth_session` table and leaves a pointer in the cookie. **One additive table + auth
> code. No SSM, no infra, no Keycloak-side change.** `session.user.*` is unchanged.

---

## How to use this prompt

1. Pull a **fresh copy of `labs-app-template`** into a separate directory (do **not**
   overlay it on your app).
2. Open **your app** (the one being upgraded) in your agent.
3. Replace `<TEMPLATE_PATH>` below with the path to that fresh template checkout.
4. Paste everything from **PROMPT START** to **PROMPT END** into the agent.

```
<TEMPLATE_PATH> = /absolute/path/to/your/fresh/labs-app-template
```

---

## PROMPT START

You are fixing a bug in the **current project** (an existing Mapp Labs app): its login
session cookie grows with the size of the user's Keycloak profile, and users with many
LDAP groups or workspaces get **HTTP 431 (Request Header Fields Too Large) on every
page**. You will move the profile-sized data out of the cookie into a database table.

The authoritative reference implementation is a fresh checkout of `labs-app-template`
at:

    <TEMPLATE_PATH>

If that path is still the literal placeholder, is empty, or doesn't look like a
`labs-app-template` checkout (no `src/modules/auth/server/auth-session.ts`, no
`prisma/migrations/20261009120000_auth_session/`), **stop and ask me for the correct
path before doing anything else.** Also remind me I should have pulled the **latest**
template into that directory, and tell me its version.

### Who I am

Assume I may **not** be a developer. **You** own the git branch and the database
migration file. Explain what you changed in plain language. Do not assume I can fill
gaps myself.

### Operating principles (read these before touching anything)

1. **The template is the reference design, not a literal source to copy.** Match its
   model and conventions, but adapt to how *this* app's auth is actually structured.
2. **Above all, do not break this app.** Login is the one thing every user touches. If
   a clean change isn't possible, stop and tell me rather than guessing.
3. **Copy verbatim only where it's clearly safe** (the two new files, the migration,
   the tests). In files this app has changed — `nextauth.ts` especially — port the
   *pattern*, don't overwrite.
4. **Surface every deviation** from the template and why.
5. **Never apply a migration to a remote database and never deploy.** You create the
   migration file and may apply it to my **local** dev database only.
6. **When something is genuinely complex, risky, or ambiguous and I can't answer, tell
   me to get help — don't guess.** Point me to the Labs Slack channels
   **#topic-mapp-labs** or **#topic-ai-support**.

### Step 0 — Branch and assess

1. Create a git branch (e.g. `retrofit/session-cookie-size`). All work goes here.
2. Read, in the template: the **2026-10-09** entry in `MIGRATION.md`,
   `src/modules/auth/server/auth-session.ts`, `src/lib/prisma/services/auth-session.ts`,
   the `jwt` / `session` callbacks and `events` block in
   `src/modules/auth/config/nextauth.ts`, and `src/app/auth/signout/page.tsx`.
3. **Decide whether this applies.** In this app's NextAuth config, find the `jwt`
   callback and look for assignments like:

   ```bash
   grep -rnE "token\.(roles|workspaces|mappLdapGroups|keycloakIdToken)\s*=" src
   ```

   - **Matches found** → this app has the bug. Continue.
   - **No matches, and no Keycloak provider at all** → not applicable. Record
     `not-applicable` (see *Record state*) and stop.
   - **No matches, but Keycloak login exists** → someone already removed them by hand.
     That stops the 431 but usually **breaks logout** and removes
     `session.user.workspaces` / `mappLdapGroups`. Tell me what you found, then
     continue — this retrofit restores both properly.
4. **Inventory what else is on the token.** List every `token.<field> = …` in the `jwt`
   callback. Anything that is an **array or object**, or whose length depends on the
   user (a list of accounts, permissions, feature flags, a second upstream token), has
   the same problem and must move too. Scalars — ids, emails, booleans, one access
   level — stay. Show me the list and which side each field lands on.
5. **Find direct readers of the raw JWT.** These are the only callers that break:

   ```bash
   grep -rn "getToken(" src
   ```

   For each hit, check whether it reads any field you are moving. Also check
   `src/proxy.ts` / `src/middleware.ts`. Note them for Step 3.

### Step 1 — Table and migration

1. Add the `AuthSession` model from the template's `prisma/schema.prisma` to this app's
   schema (keep its comment). If this app already has a model or table with that name,
   **stop and ask me**.
2. Copy the template's `prisma/migrations/20261009120000_auth_session/` directory. It is
   additive and idempotent (`CREATE TABLE IF NOT EXISTS`). If you added columns for
   extra fields in Step 0.4, add them to both the model and this SQL.
3. If I have a local dev database, apply it there (`make dev-db-migrate` or this app's
   equivalent) and run `npx prisma generate`. **Do not touch staging or production.**
4. Confirm there is no drift: the migration must contain **only** the new table and
   its index. If Prisma proposes anything else — in particular dropping
   `mapp_team_email_lower_idx` — do not accept it.

### Step 2 — Storage code

1. Copy `src/lib/prisma/services/auth-session.ts` and register it in the services index
   the way this app registers its other services (`prismaService.authSession`).
2. Copy `src/modules/auth/server/auth-session.ts`.
3. If this app's DB tests truncate a hardcoded table list (the template's
   `test/utils/db.ts` does), add `auth_session` to it.

### Step 3 — Auth wiring

Port each of these from the template into this app's equivalents:

1. **`jwt` callback, sign-in branch.** Stop assigning the moved fields to the token.
   Call `createAuthSession(...)` and store the returned id as `token.authSessionId`.
   Keep the template's `try/catch`: it falls back to the old inline behaviour **only**
   when the table doesn't exist yet (`isAuthSessionTableMissing`), which covers the few
   minutes of a deploy before the migration runs. Any other error must still fail the
   login.
2. **`session` callback.** Read the moved fields from
   `loadAuthSessionClaims(token.authSessionId)` and put them on `session.user` under the
   **same names as before**. Keep the fallback to inline token fields — sessions issued
   before this change still carry them and must keep working.
3. **`events.signOut`.** Delete the row.
4. **Sign-out page — two changes.**
   - Take the `id_token` from `getAuthSessionIdToken(token.authSessionId)`, falling
     back to `token.keycloakIdToken` for old sessions.
   - **Fix how it reads the token.** If this app's page calls
     `getToken({ req: { headers: { cookie: ... } } })`, that call has **always returned
     `null`** — `getToken()` reads `req.cookies` and ignores a raw Cookie header — so
     Keycloak logout has never run in this app. Pass the cookie store instead, as the
     template does: `req: { cookies: await cookies(), headers: {} }`. Tell me in the
     handback whether this app had the bug.
   - **Do not** remove `export const dynamic = 'force-dynamic'`.
5. **Types.** Add `authSessionId` to the JWT type; never add it to the session type.
6. **Direct JWT readers from Step 0.5.** Switch each to read the session, or to call
   `loadAuthSessionClaims`. Be careful with anything running in `proxy`/middleware —
   a database read there runs on **every request**; prefer moving that check into the
   page or route. If that isn't straightforward, stop and ask me.
7. **Never** put `authSessionId` or the `id_token` on `session.user` — that object is
   returned to browser JavaScript.

### Step 4 — Tests

1. Copy `src/modules/auth/__tests__/nextauth-auth-session.test.ts`,
   `src/lib/prisma/services/__tests__/auth-session.db.test.ts` and
   `src/__tests__/signout-page.test.ts`, adapting mocks to this app. The sign-out test
   uses the real `getToken` on purpose — do not mock it.
2. **Keep the size assertion.** It encodes a token for a user with 200 groups and fails
   if the cookie exceeds 1.5 KB. If it fails here, something profile-sized is still on
   the token — fix that; do not raise the limit.
3. Run type-check, lint and the unit tests. Run the DB tests if I have a local database.

### Guardrails (do NOT do these)

- Do **not** "fix" this by raising Node's `--max-http-header-size`. The load balancer
  has its own header limit, so it only moves the failure.
- Do **not** drop the `id_token` without replacing it. It is the only way the app can
  end the Keycloak session at logout.
- Do **not** filter or truncate the LDAP group list. Something in this app may
  authorise on a group you would cut.
- Do **not** change the routing logic in the `signIn` callback
  (`isInternal`, `isMappEmployee`). It is unrelated and security-sensitive.
- Do **not** apply the migration to a remote database, and do **not** deploy.

### Verify and hand back

- Type-check, lint and tests pass. Paste the test summary.
- If I can run the app locally (`DEV_AUTH_ENABLED=true`, `/auth/dev`): log in, confirm
  the app works, and confirm a row appeared in `auth_session`.
- Full verification needs a deploy, which is mine to do — note it.

### Record state

Before the handback, write/update **`.retrofit-state.json` at this app's repo root**
(create it if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert this retrofit under `retrofits["2026-10-09-session-cookie-size"]` with `status`
(applied / partial / skipped / not-applicable), `templateVersion` + `templateRef` (the
template version and exact git tag/SHA you worked against), an ISO-8601 UTC `at`
(`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, `notes` + any `deviations`, and
`capability: "company_login"`. Refresh `template.lastRetrofitAgainstVersion` /
`lastRetrofitAgainstRef` / `lastRetrofitAt`; don't remove other entries.

Then give me a **plain-language handback**:

1. Whether this app had the bug, and what was on the token (the Step 0.4 list).
2. What you changed, and any **deviations** from the template.
3. Any direct JWT readers you found and what you did with each.
4. **How to ship it:** the ordinary `make staging-deploy` — the migration is additive,
   so the maintenance deploy is **not** needed. Remind me that bumping the version
   first is recommended.
5. **What to check on staging:** log in; open `/admin/auth-debug` and confirm groups
   and workspaces are still listed; sign out and confirm I land on the login page. If
   I get a Keycloak **"Invalid redirect uri"** page instead, the logout URI was never
   registered — run `bash scripts/deploy/register-keycloak-uris.sh staging` (it is
   idempotent and needs VPN). Then click log in again and confirm Keycloak **asks**
   rather than passing straight through.
6. **What users will notice:** signing out now really signs them out of Keycloak, so
   the next login prompts. Before this change it silently did not.
7. **What to tell users:** nobody is logged out. Anyone currently seeing 431 must
   **clear cookies for this app's domain once** — the app cannot do it for them,
   because their requests never reach it. Everyone else gets the small cookie at
   their next login.
8. If anything got complicated and I didn't have an answer, remind me I can ask in
   **#topic-mapp-labs** or **#topic-ai-support**.

## PROMPT END
