# Retrofit prompt — Optional capability: Customer Preview ("View as customer")

> Implements the **2026-10-17 "Optional capability: Customer Preview ("View as
> customer")"** entry in [`MIGRATION.md`](../../MIGRATION.md).
>
> **Optional — only for apps with Company Login (external company customers).** Lets
> an admin-level Mapp user open a company's `/account` pages exactly as that company's
> Company-Login customers see them: read-only, 30 minutes, bound to the admin,
> audited. **Off by default and inert when off.** Requires the
> [customer-side render/scope retrofit](2026-10-17-customer-side-render-and-scope.md)
> first. **No schema, no new secret, no SSM.** Turning it on in AWS needs two plain
> env vars on the ECS task definition (a CDK change). Default deploy path.

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

You are adding the optional **"View as customer"** capability (`customer_preview`) to
the **current project** (an existing Mapp Labs app): admins get a button that opens a
company's customer pages (`/account/*`) exactly as that company's customers see them —
read-only, for 30 minutes, recorded in the audit log.

The authoritative reference implementation is a fresh checkout of `labs-app-template`
at:

    <TEMPLATE_PATH>

If that path is still the literal placeholder, is empty, or doesn't look like a
`labs-app-template` checkout (no `src/modules/customer_preview/`, no
`docs/template/capabilities/CUSTOMER_PREVIEW.md`), **stop and ask me for the correct
path before doing anything else.** Also remind me I should have pulled the **latest**
template into that directory, and tell me its version.

### Who I am

Assume I may **not** be a developer. **You** own the git branch. Explain what you
changed in plain language. Do not assume I can fill gaps myself.

### Operating principles (read these before touching anything)

1. **The template is the reference design, not a literal source to copy.** Customer
   pages and auth code are where forks diverge most. Match the template's *pattern*,
   adapted to what this app has.
2. **Above all, do not break this app.** `require-auth.ts` and the proxy run on every
   request. If a clean change isn't possible, do the safest partial version and tell me
   what you skipped.
3. **The design is finished — do not redesign it.** Read
   `<TEMPLATE_PATH>/docs/template/capabilities/CUSTOMER_PREVIEW.md` in full, especially
   **Security invariants**, **The read-only rule**, **Limitations** and **Pitfalls**.
   Every row of the invariants table is tested in the template; your port must keep
   every one of them.
4. **Copy verbatim where it's clearly safe**: `src/modules/customer_preview/` (except
   `config/subject.ts`, which is the app's seam), `src/app/admin/customer-preview/end/`,
   and the tests. In `require-auth.ts`, `customer-page-scope.ts`,
   `usage-attribution.ts`, `auth/types`, `proxy.ts`, `config/index.ts`,
   `CompanyCustomerLayout.tsx` and the action files, port the change into this app's
   version.
5. **Follow the design system** (`<TEMPLATE_PATH>/docs/template/DESIGN-SYSTEM.md`) if
   you add a launch point or touch the customer header. Use existing components.
6. **Surface every deviation** from the template and why.
7. **Never deploy, and never change AWS.** There is no migration in this retrofit.
8. **When something is genuinely complex, risky, or ambiguous and I can't answer, tell
   me to get help — don't guess.** Point me to **#topic-mapp-labs** or
   **#topic-ai-support**.

### Step 0 — Branch and assess

1. Create a git branch (e.g. `retrofit/customer-preview`). All work goes here.
2. Read, in the template: the **2026-10-17** customer-preview entry in `MIGRATION.md`;
   `docs/template/capabilities/CUSTOMER_PREVIEW.md`; the `customer_preview` entry in
   `docs/template/capabilities/_registry.json`; `src/modules/customer_preview/**`;
   `src/modules/auth/server/require-auth.ts` (`getCustomerRequestSession`,
   `isServerActionRequest`, `requireCustomer`); `customer-page-scope.ts`;
   `usage-attribution.ts`; `src/modules/auth/types/index.ts`
   (`CustomerPreviewSessionInfo`, `customerPreview`, `RequireCustomerOptions.readOnly`);
   `src/proxy.ts`; `src/config/index.ts` (`customerPreview`);
   `src/modules/audit/entity-types.ts`;
   `src/components/account/layout/CompanyCustomerLayout.tsx`;
   `src/lib/actions/account/account-actions.ts`, `account-profile-actions.ts`,
   `src/lib/actions/admin/activity-actions.ts`; `src/app/admin/company-users/`.
3. **Preconditions — check each; stop at the first that fails:**
   - **Company Login is present:** `evaluateCustomerEligibility`,
     `resolveCompanyContext` and `isCompanyCustomer` exist, and there is a
     `CompanyCustomerLayout` (or equivalent company-customer shell). If not — the app
     never took the 2026-06-10 Keycloak company-context retrofit, or it is
     Mapp-internal-only (`COMPANY_LOGIN_ENABLED=false`) — record `not-applicable` (see
     *Record state*) and stop: there are no company customers to preview.
   - **The customer-side render/scope retrofit is applied:**

     ```bash
     grep -n "getCustomerRequestSession" src/modules/auth/server/require-auth.ts
     ls src/modules/auth/server/customer-page-scope.ts
     grep -n '"2026-10-17-customer-side-render-and-scope"' .retrofit-state.json
     ```

     If `getCustomerRequestSession` or `customer-page-scope.ts` is missing, **stop** and
     tell me to run `docs/retrofit/2026-10-17-customer-side-render-and-scope.md` first.
     The overlay has exactly one hook point and it is that function.
   - **The audit log is present** (`src/modules/audit`, `writeAuditLog`,
     `AUDIT_ENTITY_TYPES`, from the 2026-10-09 retrofit). If not, stop and tell me to
     apply that one first: an unaudited preview is not acceptable.
4. **Detect what is already applied** — each item independently:

   ```bash
   ls src/modules/customer_preview/ src/app/admin/customer-preview/end/route.ts
   grep -n "resolveCustomerPreview\|isServerActionRequest\|CustomerPreviewReadOnlyError" src/modules/auth/server/require-auth.ts
   grep -n "readOnly" src/modules/auth/server/customer-page-scope.ts src/modules/auth/types/index.ts
   grep -n "customerPreview" src/modules/auth/server/usage-attribution.ts src/modules/auth/types/index.ts src/config/index.ts
   grep -n "allowsCustomerArea" src/proxy.ts
   grep -n '"company"' src/modules/audit/entity-types.ts
   grep -n "CustomerPreviewBanner\|Exit preview" src/components/account/layout/CompanyCustomerLayout.tsx
   grep -rn "assertNotPreview\|isPreviewSession" src/lib/actions src/app
   grep -n "CustomerPreviewLauncher\|canStartCustomerPreview" -r src/app/admin
   grep -n "customer_preview" app.config.json
   ```

   Tell me which parts are present. If everything is (including the app's own
   mutations, Step 5), record `applied` and stop.
5. **Ask me: do you want "View as customer" switched on, or only the inert hooks?**
   Explain in one or two sentences: *enabled* means admin-level users see a "View as
   customer" button and can open any company's customer pages read-only for 30
   minutes, with each start/end in the audit log; *hooks only* means the code is in
   place but does nothing until someone sets `CUSTOMER_PREVIEW_ENABLED=true`. Both
   cases do Steps 1–6; only *enabled* does Step 7. Wait for my answer.
6. **Inventory the app's customer mutations.** List every server action, route handler
   and other code path that a customer session can reach and that **writes or
   triggers anything**: DB writes, emails, magic links, API keys, uploads, activity
   rows, calls that change another system, metered usage (LLM, external APIs). Search
   at least for `requireCustomer`, `requireEligibleCustomer`, `getCustomerPageScope`,
   `requireEligibleCustomerPageScope` and `'use server'` under `src/app/account`,
   `src/lib/actions`, `src/app/api/account` and `src/modules`. Show me the list —
   Step 5 changes every entry on it.
7. **Inventory customer client components that branch on `useSession()`** (layout,
   nav, header, anything that hides/shows by role). During a preview the browser
   session is still the *admin's*, so those would show admin chrome. Show me the list.
8. **Inventory the data the seam needs.** Does this app keep its own companies /
   workspaces tables (e.g. after installing the client_catalog scaffold), or does it
   rely on the Company Management Service (`CLIENT_CATALOG_BASE_URL`), or neither?
   What does its eligibility policy (`customerEligibilityPolicy`) check — which
   workspace service codes?

### Step 1 — Module and end route

1. Copy `src/modules/customer_preview/` and `src/app/admin/customer-preview/end/`
   (route + tests). Keep `lib/token.ts`, `lib/guard.ts`, `lib/constants.ts`,
   `server/resolve.ts`, `server/actions.ts`, `server/end-route.ts`,
   `server/subject-cache.ts` and the components **as they are**; fix only import paths
   that differ in this app.
2. Add `config.customerPreview` to `src/config/index.ts` exactly as the template does:
   `enabled` requires `CUSTOMER_PREVIEW_ENABLED === "true"` **and** Company Login on.
3. Add the `company` entry to `AUDIT_ENTITY_TYPES` in
   `src/modules/audit/entity-types.ts` (point `href` at this app's company page if it
   has one). No migration.

### Step 2 — Auth hooks (inert when off)

1. **Types:** add `CustomerPreviewSessionInfo`, `customerPreview?` on the session
   claims, and `readOnly?` on `RequireCustomerOptions`, with the template's comments.
2. **`require-auth.ts`:** make `getCustomerRequestSession` return
   `{ session, preview }` via `resolveCustomerPreview(session, { adminGate })`, where
   `adminGate` runs **the same** security checks `requireAdmin` runs in this app (status,
   IP allow-list, superadmin-only mode). Add `isServerActionRequest`. In
   `requireCustomer`: `preview.kind === 'invalid'` → redirect to
   `${CUSTOMER_PREVIEW_END_PATH}?reason=${preview.status}`; `preview.kind === 'active'`
   and not `options.readOnly` and a server-action request → throw
   `CustomerPreviewReadOnlyError`. Keep it `cache()`d. Change nothing else about who
   `requireCustomer` / `requireAdmin` admit.
3. **`customer-page-scope.ts`:** add `readOnly` to the options and to the memo key.
4. **`usage-attribution.ts`** (if the app has it): the early return for
   `user.customerPreview` → the admin's `adminMappUserId`, `companyId: null`,
   `companyUserId: null`. If the app meters usage somewhere else, apply the same rule
   there and tell me.
5. **`proxy.ts`** (or `middleware.ts`): replace the customer-area check with
   `allowsCustomerArea({ role, accountId, isApi, previewEnabled, hasPreviewCookie })`.
   Customers and the legacy admin-with-`accountId` path must behave exactly as before.

### Step 3 — Customer shell

1. **`CompanyCustomerLayout`:** read `session.user.customerPreview` from the **server**
   session prop; when present render `CustomerPreviewBanner` and replace Sign out with
   a plain `<a href={CUSTOMER_PREVIEW_END_PATH}>Exit preview</a>` (not `<Link>`).
2. For each component from Step 0.7: make it decide from the server session passed
   down, not `useSession()`. If one can't be converted safely, list it as a known
   limitation in the handback.

### Step 4 — The subject seam

`src/modules/customer_preview/config/subject.ts` is **this app's** code.

- If the app has its **own companies/workspaces tables**, override
  `resolvePreviewSubject` to read them (the file header has the client_catalog-scaffold
  version). Workspace ids must be **client-catalog** workspace ids (what a real session
  carries), not local primary keys; `accountId` must equal
  `resolveAccountIdForCompany(companyId)`; return `null` for unknown or inactive
  companies; keep it a cheap, side-effect-free read.
- Otherwise keep the template default (client catalog when `CLIENT_CATALOG_BASE_URL`
  is set, `company_user` stub otherwise) and tell me which one this app will use.
- If the eligibility policy needs per-workspace service codes that differ, return
  per-workspace `services`.

### Step 5 — The read-only rule

1. Confirm the template's own customer mutations in this app (`updateUserNames`,
   `inviteTeamMember`, both magic-link actions, `updateCustomerProfileRequest`,
   `accountActivity`, `logPageVisit`) carry the template's `assertNotPreview` /
   `isPreviewSession` checks.
2. **Every entry from Step 0.6** gets `assertNotPreview(session)` right after it
   obtains the session and **before** it writes — or `isPreviewSession(session)` with
   its own error shape (`CUSTOMER_PREVIEW_READ_ONLY_MESSAGE`). Route handlers too: the
   central server-action guard does not cover them.
3. A server action that only **reads** and is called from the client may pass
   `{ readOnly: true }` to `requireCustomer` / `getCustomerPageScope`. Never on one
   that writes, and never on one that calls `revalidatePath`.
4. Hide (don't disable) customer mutation controls when `isPreviewSession(session)`,
   where the app already hides controls for viewers.

### Step 6 — Launch points and tests

1. Port the `/admin/company-users` launch point (`canStartCustomerPreview(session)` on
   the server, `CustomerPreviewLauncher` on the first row of each company,
   `CustomerPreviewNotice` on the page). If the app has its own company page, add
   `<CustomerPreviewLaunch>` there with the company's workspaces.
2. Copy the tests: `src/modules/customer_preview/__tests__/*`,
   `src/app/admin/customer-preview/end/__tests__/route.test.ts`,
   `src/modules/auth/__tests__/require-auth-preview.test.ts`,
   `src/components/account/layout/__tests__/CompanyCustomerLayout.test.tsx`,
   `src/lib/actions/account/__tests__/customer-preview-readonly.test.ts` — and **add
   every mutation from Step 0.6** to the read-only test. Adapt mocks; do not weaken an
   assertion to make it pass. If you overrode the seam, test it.
3. Run type-check, lint and the unit tests (and the DB tests if the app runs them).

### Step 7 — Turn it on (only if I chose *enabled* in Step 0.5)

1. **Local `.env`:** `CUSTOMER_PREVIEW_ENABLED=true` and `CUSTOMER_PREVIEW_SERVICES=`
   set to the service codes from Step 0.8 (Keycloak claim codes, not client-catalog
   product names; empty only with an allow-all policy). Add the commented stubs to
   `.env.example`.
2. **Staging/production:** these are plain, non-secret flags, so add both to the ECS
   task definition **`environment`** block in `infra/lib/stack.ts` (not `secrets`, not
   SSM, not `setup-ssm-params.sh`). Tell me this is a CDK change that needs
   `make staging-infra-diff` then `make staging-infra-deploy` — `make staging-deploy`
   alone does not change the task definition. Do not run either.
3. Add `"customer_preview"` to `app.config.json` `enabledCapabilities` (and
   `company_login` if missing).

### Guardrails (do NOT do these)

- Do **not** weaken, skip or "simplify" any row of the **Security invariants** table in
  `CUSTOMER_PREVIEW.md` — the signed, constant-time-compared token keyed with
  `NEXTAUTH_SECRET`; the cookie flags and lifetimes; admin level or SuperAdmin, active,
  passing the same checks as `requireAdmin`, re-checked on **every** request; binding to
  the admin's email; invalid cookie → end route; the synthesized session built **field
  by field** with no `access`, `accessStatus`, `adminId`, `userId` and
  `isSuperAdmin: false`; workspaces = chosen ∩ current (narrow, never widen); capability
  off → cookie not read; no cookie → no DB or network work; proxy admits `/account`
  pages only, never `/api/account/*`; relative `Location` and a re-sanitised `returnTo`
  in the end route; usage attributed to the admin; start/end audited.
- Do **not** let unknown or foreign workspace ids be dropped or coerced — the start
  action refuses the whole request.
- Do **not** leave any customer mutation without `assertNotPreview` /
  `isPreviewSession`, and never pass `readOnly: true` on an action that writes.
- Do **not** decide customer layout or nav from `useSession()`.
- Do **not** format the preview end time during render (keep `PreviewEndTime`), and do
  not link to the end route with `<Link>`.
- Do **not** change or remove `/auth/admin-view-account` — legacy apps still use it.
- Do **not** enable the capability unless I chose *enabled* in Step 0.5.
- Do **not** deploy, run CDK, or change SSM.

### Verify and hand back

- Type-check, lint and tests pass. Paste the test summary.
- With the capability **off**: an admin without a cookie is still refused at
  `/account`; customers behave exactly as before; no launch button is shown.
- If I chose *enabled* and can run the app locally (`DEV_AUTH_ENABLED=true` +
  `CUSTOMER_PREVIEW_ENABLED=true`): sign in at `/auth/dev` once as a **customer** of a
  company, then as an **admin**; open `/admin/company-users`, press **View as
  customer**; the banner shows and the header says **Exit preview**; a customer
  mutation is refused with the read-only message; **Exit** returns to Company Users
  with "stopped viewing"; `/admin/audit-log` shows `customer_preview_start` and
  `customer_preview_end` for entity type Company.

### Record state

Before the handback, write/update **`.retrofit-state.json` at this app's repo root**
(create it if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert this retrofit under `retrofits["2026-10-17-customer-preview"]` with `status`
(applied / partial / skipped / not-applicable), `templateVersion` + `templateRef` (the
template version and exact git tag/SHA you worked against), an ISO-8601 UTC `at`
(`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, `notes` + any `deviations`. In `notes`, say
whether the capability is **enabled or hooks-only**, which seam the app uses (template
default or override), and the `CUSTOMER_PREVIEW_SERVICES` value chosen. Use
`not-applicable` without Company Login, and `skipped` if I declined it. Refresh
`template.lastRetrofitAgainstVersion` / `lastRetrofitAgainstRef` / `lastRetrofitAt`;
don't remove other entries.

Then give me a **plain-language handback**:

1. Which parts were already present and which you added; enabled or hooks-only.
2. The app's customer mutations you guarded (from Step 0.6), and any you were unsure
   about.
3. Which subject seam the app uses, and why.
4. Client components that still branch on `useSession()` (known limitation), if any.
5. Any **deviations** from the template and why.
6. **How to ship it:** the ordinary `make staging-deploy` — no migration, so the
   maintenance deploy is **not** needed; the capability stays off until the env vars
   reach the container. Remind me that bumping the version first is recommended (a
   patch for hooks-only, a minor if enabling).
7. **If enabling:** the two env vars are in `infra/lib/stack.ts`, so after the deploy
   run `make staging-infra-diff` (check it only adds the two variables) and
   `make staging-infra-deploy`; staging first, then production.
8. **What changes for users:** nothing for customers. With the capability on,
   admin-level users get "View as customer" on Company Users; each preview is
   read-only, ends after 30 minutes, and is in the audit log.
9. If anything got complicated and I didn't have an answer, remind me I can ask in
   **#topic-mapp-labs** or **#topic-ai-support**.

## PROMPT END
