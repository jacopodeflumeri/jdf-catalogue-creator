# Retrofit prompt — Customer pages render from the server session; auth lookups once per request

> Implements the **2026-10-17 "Customer pages render from the server session; auth
> lookups once per request"** entry in [`MIGRATION.md`](../../MIGRATION.md).
>
> **Applies to every fork with the `/account` customer area.** Customer pages painted a
> full-screen spinner until the browser fetched the session, the top nav popped in
> after hydration, the footer floated, and every page repeated its auth lookups. This
> renders the customer shell from the server session, adds a loading skeleton, and
> resolves session / eligibility / company context **once per request**, in parallel.
> **Code only. No schema, no SSM, no infra, no env vars.** Default deploy path.

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

You are improving the **customer side** (`/account`) of the **current project** (an
existing Mapp Labs app): making customer pages paint real content on first load
instead of a spinner, stopping the top nav and footer from jumping, adding a loading
skeleton, and making each request resolve the customer's session, eligibility and
company context once instead of repeatedly.

The authoritative reference implementation is a fresh checkout of `labs-app-template`
at:

    <TEMPLATE_PATH>

If that path is still the literal placeholder, is empty, or doesn't look like a
`labs-app-template` checkout (no `src/modules/auth/server/customer-page-scope.ts`, no
`src/app/account/loading.tsx`), **stop and ask me for the correct path before doing
anything else.** Also remind me I should have pulled the **latest** template into that
directory, and tell me its version.

### Who I am

Assume I may **not** be a developer. **You** own the git branch. Explain what you
changed in plain language. Do not assume I can fill gaps myself.

### Operating principles (read these before touching anything)

1. **The template is the reference design, not a literal source to copy.** Customer
   pages are where forks diverge most. Match the template's *pattern*, adapted to the
   pages this app actually has.
2. **Above all, do not break this app.** Every customer touches these files. If a clean
   change isn't possible, do the safest partial version and tell me what you skipped.
3. **Copy verbatim only where it's clearly safe** (`customer-page-scope.ts`, the tests).
   In `CustomerLayoutClient.tsx`, `require-auth.ts`, the account pages and
   `loading.tsx`, port the pattern.
4. **Follow the design system.** Read `<TEMPLATE_PATH>/docs/template/DESIGN-SYSTEM.md`
   (sections on loading skeletons, page headers and layouts) before changing UI. Use
   existing components and tokens.
5. **Surface every deviation** from the template and why.
6. **Never deploy.** There is no migration in this retrofit.
7. **When something is genuinely complex, risky, or ambiguous and I can't answer, tell
   me to get help — don't guess.** Point me to **#topic-mapp-labs** or
   **#topic-ai-support**.

### Step 0 — Branch and assess

1. Create a git branch (e.g. `retrofit/customer-side-render`). All work goes here.
2. Read, in the template: the **2026-10-17** customer-pages entry in `MIGRATION.md`;
   `src/components/account/layout/CustomerLayoutClient.tsx` and
   `CompanyCustomerLayout.tsx`; `src/app/account/layout.tsx`, `page.tsx`,
   `loading.tsx`, `settings/page.tsx`, `get-started/page.tsx`;
   `src/modules/auth/server/require-auth.ts` (`getCurrentSession`,
   `getCustomerRequestSession`), `customer-page-scope.ts`, `customer-eligibility.ts`,
   `company-context.ts`; `src/lib/actions/account/account-profile-actions.ts`;
   `src/components/account/PageActivityLogger.tsx`; `src/components/ui/PageHeader.tsx`;
   the "Customer page scope" paragraph in `docs/template/capabilities/COMPANY_LOGIN.md`.
3. **Does this app have a customer area at all?** If there is no `src/app/account/`
   (or equivalent customer route group), record `not-applicable` (see *Record state*)
   and stop.
4. **Detect what is already applied** — each item independently:

   ```bash
   grep -n 'status === "loading"\|useSession' src/components/account/layout/CustomerLayoutClient.tsx
   grep -n "NavigationWrapper\|<Navigation\b\|NavigationComponent" src/components/account/layout/CustomerLayoutClient.tsx
   ls src/app/account/loading.tsx
   grep -n "cache(" src/modules/auth/server/require-auth.ts
   ls src/modules/auth/server/customer-page-scope.ts
   grep -n "cache(" src/modules/auth/server/customer-eligibility.ts src/modules/auth/server/company-context.ts
   grep -n "isCompanyCustomer" src/components/account/PageActivityLogger.tsx
   grep -n 'size' src/components/ui/PageHeader.tsx
   ```

   Tell me which parts are present. If everything is, record `applied` and stop.
5. **Company Login present?** Check for `evaluateCustomerEligibility` and
   `resolveCompanyContext` in `src/modules/auth/server/`. If they are missing (the fork
   never took the 2026-06-10 company-context retrofit), **skip Step 3's scope helper**
   and do the rest; record `partial` with that reason.
6. **Inventory the eligibility policy.** Open this app's `customerEligibilityPolicy`
   (or equivalent). After this change it is memoized per request, so it **must be a
   pure read** of the session and database. If it writes, increments, sends anything,
   or logs something that must happen per call, **stop and show me** before continuing.
7. **List every customer page** under `src/app/account/` and how each starts
   (`requireCustomer`, `requireEligibleCustomer`, `evaluateCustomerEligibility`,
   `resolveCompanyContext`, `requireFeature`, `getCustomerProfile`). Show me the list.

### Step 1 — Customer shell

1. **`CustomerLayoutClient`:** remove any `if (status === "loading") return <Loading/>`
   gate (or any other gate on `useSession()` around `{children}`). Anything in the
   shell that depends on the session reads the `session` prop the server layout passes.
   Keep the template's comment explaining why.
2. Render **`NavigationComponent`** (named export of `@/modules/navigation`) instead of
   the default `Navigation` / `NavigationWrapper`, and read `?simple=true` with
   `useSearchParams()` to pass `isSimpleMode`, in every place the layout renders the nav.
3. Make `main` a flex column with a `flex-1 flex flex-col` wrapper around the provider
   and `{children}`, so the footer stays at the bottom. Do the same `flex-1 flex
   flex-col` on `CompanyCustomerLayout`'s `main` if the app has it.
4. **`src/app/account/loading.tsx`:** add a skeleton shaped like the page customers
   most often land on in **this** app (same container width, header, card shape) —
   not necessarily the template's home. Use `ds-skeleton` / `aria-busy` as the template
   does. If `/account` already has a `loading.tsx`, keep it and tell me.

### Step 2 — Session once per request

1. In `require-auth.ts`, wrap `getCurrentSession` in React `cache()` (from `react`).
   This affects admin helpers too; that is intended — every `require*` call in a request
   then shares one session decode and one session **object**.
2. Add `getCustomerRequestSession` (also `cache()`d, returning `getCurrentSession()`)
   and make `requireCustomer` read through it. Keep its comment: it is the single place
   a session could later be substituted for customer pages.
3. Do not change what `requireCustomer` / `requireAdmin` check or where they redirect.

### Step 3 — Customer page scope (Company Login forks only)

1. Wrap `evaluateCustomerEligibility` and `resolveCompanyContext` in `cache()` (keep
   them exported under the same names), and memoize the customer-profile load the way
   the template's `account-profile-actions.ts` does (an un-exported `cache()`d loader
   keyed on the session — a `'use server'` file may only export async functions).
2. Copy `customer-page-scope.ts` and export `getCustomerPageScope`,
   `requireEligibleCustomerPageScope` and their types from `src/modules/auth/server.ts`.
3. Move each content page from Step 0.7 onto `requireEligibleCustomerPageScope()`
   (eligibility enforced) or `getCustomerPageScope()` (where the page checks
   eligibility itself, e.g. onboarding). Keep each page's `redirectTo` if it had one.
   Where a page called `requireFeature` and then loaded the profile again, use the
   profile `requireFeature` returns.
4. In `src/app/account/layout.tsx`, keep awaiting **only** `requireCustomer()` (not the
   scope — that would hold back the shell and the skeleton), and run the
   account-disabled check and profile load with `Promise.all`.

### Step 4 — Small pieces

1. **`PageActivityLogger`:** return early when `isCompanyCustomer(session)` (from
   `@/modules/auth/client`), before calling the logging action. Legacy customers are
   still logged.
2. **`PageHeader`:** add the `size?: "default" | "compact"` prop from the template and
   use `size="compact"` on customer pages that hand-roll a smaller header — only where
   it doesn't change a design the app owner chose.

### Step 5 — Tests

1. Copy `src/components/account/layout/__tests__/CustomerLayoutClient.test.tsx`
   (renders children while `useSession` reports `"loading"`),
   `src/modules/auth/__tests__/customer-page-scope.test.ts` (Company Login forks) and
   `src/components/account/__tests__/PageActivityLogger.test.tsx`, adapting mocks.
2. Existing tests that mock `@/modules/navigation` may need `NavigationComponent` added.
3. Run type-check, lint and the unit tests.

### Guardrails (do NOT do these)

- Do **not** gate `{children}` on `useSession()` anywhere in a layout.
- Do **not** await the scope (eligibility / company context) in the `/account` layout.
- Do **not** memoize a function with side effects. If the eligibility policy has any,
  stop and ask me (Step 0.6).
- Do **not** change auth decisions — who is let in, who is redirected where. This
  retrofit only changes *when* and *how often* they are computed.
- Do **not** deploy.

### Verify and hand back

- Type-check, lint and tests pass. Paste the test summary.
- If I can run the app locally (`DEV_AUTH_ENABLED=true`, `/auth/dev`, sign in as a
  customer): `curl -s http://localhost:3000/account -H "cookie: <session cookie>"` or
  view-source shows page content (or the skeleton), not just a spinner; the nav doesn't
  jump on load; the footer sits at the bottom of a short page.

### Record state

Before the handback, write/update **`.retrofit-state.json` at this app's repo root**
(create it if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert this retrofit under `retrofits["2026-10-17-customer-side-render-and-scope"]`
with `status` (applied / partial / skipped / not-applicable), `templateVersion` +
`templateRef` (the template version and exact git tag/SHA you worked against), an
ISO-8601 UTC `at` (`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, `notes` + any `deviations`.
Use `partial` if you skipped the scope helper (no Company Login) and say so in
`notes`. Refresh `template.lastRetrofitAgainstVersion` / `lastRetrofitAgainstRef` /
`lastRetrofitAt`; don't remove other entries.

Then give me a **plain-language handback**:

1. Which parts were already present and which you added.
2. The customer pages you moved onto the scope, and any you left alone and why.
3. Whether the eligibility policy was a pure read (and what you did if not).
4. Any **deviations** from the template and why.
5. **How to ship it:** the ordinary `make staging-deploy` — no migration, so the
   maintenance deploy is **not** needed. Remind me that bumping the version first is
   recommended (a patch).
6. **What changes for users:** customer pages appear faster, with no spinner flash or
   jumping header/footer.
7. **One thing for whoever runs monitoring or tests:** a redirect issued by an
   `/account` *page* (e.g. an ineligible customer sent to onboarding) now arrives after
   the page has started streaming, so it shows up as HTTP 200 with a client-side
   redirect rather than a 307. The sign-in redirect from the layout is unchanged.
8. If anything got complicated and I didn't have an answer, remind me I can ask in
   **#topic-mapp-labs** or **#topic-ai-support**.

## PROMPT END
