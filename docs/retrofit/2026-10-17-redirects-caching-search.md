# Retrofit prompt — Safe redirects, private API caching, escaped search

> Implements two **2026-10-17** entries in [`MIGRATION.md`](../../MIGRATION.md):
> **"Sign-in redirects: open redirect fixed, `callbackUrl` honoured"** and
> **"Public API: key-scoped responses are `private`; search input is escaped"**.
>
> **Security fixes — applies to every fork.** Closes an **open redirect** in
> `/auth/admin-view-account`, makes sign-in return people to the page they asked for
> (safely), stops shared caches from serving one API key's data to another, and stops
> `%` / `_` in a search box from matching every row. **Code only. No schema, no SSM, no
> infra, no env vars.** Default deploy path.

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

You are fixing three security issues in the **current project** (an existing Mapp Labs
app):

- **A. Redirects.** A user-controlled `callbackUrl` is followed without validation
  (an open redirect, and a `javascript:` URL could run in the app's origin). Sign-in
  also ignores `callbackUrl`, so bookmarks are lost when a session expires.
- **B. API caching.** Public API responses that depend on the caller's API key are
  sent as `public`, so a CDN or proxy may serve them to a different key.
- **C. Search.** User search terms reach Prisma `contains` / `startsWith` /
  `endsWith` unescaped, so `%` and `_` act as wildcards.

The authoritative reference implementation is a fresh checkout of `labs-app-template`
at:

    <TEMPLATE_PATH>

If that path is still the literal placeholder, is empty, or doesn't look like a
`labs-app-template` checkout (no `src/modules/auth/lib/callback-url.ts`, no
`src/lib/utils/search.ts`), **stop and ask me for the correct path before doing
anything else.** Also remind me I should have pulled the **latest** template into that
directory, and tell me its version.

### Who I am

Assume I may **not** be a developer. **You** own the git branch. Explain what you
changed in plain language. Do not assume I can fill gaps myself.

### Operating principles (read these before touching anything)

1. **The template is the reference design, not a literal source to copy.** Match its
   model, adapted to this app.
2. **Above all, do not break this app** — and in particular do not break login. If a
   clean change isn't possible, stop and tell me.
3. **Copy verbatim where it's clearly safe** (`callback-url.ts`,
   `preserve-search-params.ts`, `search.ts`, the cache helpers, the tests). In pages and
   services this app has changed, port the pattern.
4. **Find the app's own instances.** The template fixed its own call sites; this app
   probably has more. Searching for them is the most valuable part of this retrofit.
5. **Surface every deviation** from the template and why.
6. **Never deploy.** There is no migration in this retrofit.
7. **When something is genuinely complex, risky, or ambiguous and I can't answer, tell
   me to get help — don't guess.** Point me to **#topic-mapp-labs** or
   **#topic-ai-support**.

### Step 0 — Branch and assess

1. Create a git branch (e.g. `retrofit/redirects-caching-search`). All work goes here.
2. Read, in the template: both **2026-10-17** entries named above in `MIGRATION.md`;
   `src/modules/auth/lib/callback-url.ts` (and its test);
   `src/app/auth/admin-view-account/page.tsx`; `src/app/auth/admin/AdminSignInClient.tsx`
   and `page.tsx`; `src/app/auth/dev/DevLoginClient.tsx`; `src/app/auth/signin/page.tsx`;
   `src/app/_lib/preserve-search-params.ts`; `src/modules/public_api/lib/cache.ts` and
   `auth.ts`; `src/lib/utils/search.ts`; the search code in
   `src/lib/prisma/services/{audit-log,company-user,mapp-team}.ts`; the **Caching Rule**
   and **Search Rule** sections of `docs/template/capabilities/PUBLIC_API.md`.
3. **Detect what is already applied:**

   ```bash
   ls src/modules/auth/lib/callback-url.ts src/lib/utils/search.ts src/app/_lib/preserve-search-params.ts
   grep -n "privateCacheHeaders\|API_KEY_HEADER" -r src/modules/public_api 2>/dev/null
   ```

   If all are present and used as in the template, record `applied` and stop.
4. **Inventory redirect sinks** — every place the app navigates to a value that came
   from the request:

   ```bash
   grep -rnE "callbackUrl|returnTo|redirectTo|[?&]next=|window\.location(\.href)?\s*=|router\.(push|replace)\(" src --include=*.ts --include=*.tsx
   ```

   For each hit, note whether the target is user-controlled (query param, form field,
   header) or a constant. Show me the user-controlled ones.
5. **Inventory API cache headers** (only if `src/modules/public_api/` exists):

   ```bash
   grep -rn "cacheHeaders\|snapshotCacheHeaders\|Cache-Control" src/app/api src/modules/public_api
   ```

   For each endpoint, decide: is the response **identical for every API key** (e.g. a
   global taxonomy) or does it depend on the key (account scope, key type)? Show me the
   table.
6. **Inventory pattern searches:**

   ```bash
   grep -rnE "(contains|startsWith|endsWith):" src --include=*.ts --include=*.tsx
   ```

   For each hit, note whether the value comes from user input (search box, query
   string, API parameter) and whether the surface is external (customer pages, public
   API) or admin-only. Show me the list.

### Step 1 — Redirects (A)

1. Copy `src/modules/auth/lib/callback-url.ts` and
   `src/modules/auth/__tests__/callback-url.test.ts`.
2. **`/auth/admin-view-account/page.tsx`:** replace `resolvedSearchParams.callbackUrl ||
   '/account'` with `resolveCallbackUrl(resolvedSearchParams.callbackUrl, 'account')`
   (server side, no origin). Note on the client prop that it is pre-validated.
3. **`AdminSignInClient` / `DevLoginClient`** (if present): read `callbackUrl` from the
   query and pass `resolveCallbackUrl(requested, area, window.location.origin)` to
   `signIn` — `account` for Company Login and customer dev logins, `admin` otherwise.
   If the app has a `DEV_AUTH_ENABLED` dev login, add the template's **Developer login
   (local only)** link on `/auth/admin` forwarding `callbackUrl` (pass `devAuthEnabled`
   from the server page; never show it in production).
4. **`/auth/signin`:** if it redirects onward, forward the whole query with
   `withPreservedSearchParams` (copy `src/app/_lib/preserve-search-params.ts` + test).
5. **Every user-controlled sink from Step 0.4:** route it through
   `resolveCallbackUrl` with the right area. If a sink legitimately needs a target
   outside `/account` / `/admin`, **stop and ask me** rather than widening the helper.

### Step 2 — API caching (B) — skip if there is no public API

1. Port `privateCacheHeaders()` and `API_KEY_HEADER` into
   `src/modules/public_api/lib/cache.ts` (with the header comment), export both from the
   module index, and make `withApiKeyAuth` read the key via `API_KEY_HEADER`.
2. Switch **every key-dependent endpoint** from Step 0.5 to `privateCacheHeaders()`.
   When in doubt, private — it only costs a re-fetch.
3. Copy `src/modules/public_api/lib/__tests__/cache.test.ts`.

### Step 3 — Search (C)

1. Copy `src/lib/utils/search.ts` and `src/lib/utils/__tests__/search.test.ts`.
2. Apply `toContainsTerm()` (or `escapeLikePattern()` on an already-trimmed value) to
   the template's three services where this app has them (audit log, Company Users,
   Mapp Team), and to **every user-input hit from Step 0.6**. Do **not** apply it to
   `equals` filters — escapes would be matched literally.
3. On **external** surfaces, also check the Search Rule: the search must only match
   columns the caller is shown. If a customer or API search matches an internal or
   withheld column, tell me — removing it from the search is the fix, but it changes
   behaviour, so confirm with me first.
4. Copy `src/lib/prisma/services/__tests__/search-escaping.db.test.ts`, keeping only
   the services this app has. If the app's `test/utils/db.ts` truncates a hardcoded
   table list and the app has `company_user`, add it.

### Step 4 — Tests

1. Copy `src/app/auth/__tests__/sign-in-callback-url.test.tsx` and
   `src/app/_lib/__tests__/preserve-search-params.test.ts`, adapting props to this
   app's sign-in components.
2. Run type-check, lint and the unit tests; run `make dev-test-db` if I have a local
   database.

### Guardrails (do NOT do these)

- Do **not** "fix" an open redirect with a string `startsWith('/')` check: `//evil.com`
  and `/\evil.com` pass it. Use `resolveCallbackUrl`.
- Do **not** widen `resolveCallbackUrl` to accept other origins or areas.
- Do **not** change *who* can sign in or *which area* each login lands in.
- Do **not** switch global, key-independent endpoints to private just to be uniform
  without telling me — it's safe, but it drops CDN caching for them.
- Do **not** escape `equals` values, and do not remove a search column without asking.
- Do **not** deploy.

### Verify and hand back

- Type-check, lint and tests pass. Paste the test summary.
- If I can run the app locally: signed out, open a deep `/admin/...` link and confirm
  login returns you to it; open
  `/auth/admin-view-account?accountId=<id>&callbackUrl=https://example.com` as an admin
  and confirm you land on `/account`; search Mapp Team for `%` and confirm nothing
  matches.

### Record state

Before the handback, write/update **`.retrofit-state.json` at this app's repo root**
(create it if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert this retrofit under `retrofits["2026-10-17-redirects-caching-search"]` with
`status` (applied / partial / skipped / not-applicable), `templateVersion` +
`templateRef`, an ISO-8601 UTC `at` (`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, `notes` +
any `deviations`. Note in `notes` whether the app has a public API (Step 2 applied or
not-applicable) and list any sinks or searches you deliberately left alone. Refresh
`template.lastRetrofitAgainstVersion` / `lastRetrofitAgainstRef` / `lastRetrofitAt`;
don't remove other entries.

Then give me a **plain-language handback**:

1. **What was exposed** before the fix, in plain words (the redirect sinks, the
   key-dependent endpoints that were public, the unescaped searches) — and on which
   surfaces (admin-only vs customer/external).
2. What you changed, and any **deviations** from the template.
3. Anything you left for me to decide (searches on withheld columns, odd redirect
   targets).
4. **How to ship it:** the ordinary `make staging-deploy` — no migration, so the
   maintenance deploy is **not** needed. Remind me that bumping the version first is
   recommended (a patch). Because these are security fixes, suggest shipping to
   production soon after staging checks out.
5. **What to check on staging:** a deep link survives sign-in; the admin-view-account
   check above; an API response from a key-scoped endpoint shows
   `Cache-Control: private` and `Vary: X-API-Key`.
6. If anything got complicated and I didn't have an answer, remind me I can ask in
   **#topic-mapp-labs** or **#topic-ai-support**.

## PROMPT END
