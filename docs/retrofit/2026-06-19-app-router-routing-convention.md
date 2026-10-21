# Retrofit prompt — App-Router correctness + routing convention

> Implements the **2026-06-19 "App Router correctness: error boundaries,
> instrumentation, admin SSR + routing convention"** entry in
> [`MIGRATION.md`](../../MIGRATION.md).
>
> **Mandatory / applies to all forks.** Two of these are **latent correctness bugs**
> every fork inherits. It is also the **foundation** for canonical external-id routing
> that the Client Catalog and UPC capabilities build on — do this before either of
> those. **Pure code: no database migration, no env vars, no infra changes.**

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

You are applying the template's **App-Router correctness fixes and admin routing
convention** to the **current project** (an existing Mapp Labs app). This is **pure
code** — there is **no database migration, no env var, and no infrastructure change**
in this work. Two of the items fix **latent bugs** this app almost certainly has, and
one installs the **routing convention** that the Client Catalog / UPC capabilities
later depend on.

The authoritative reference implementation is a fresh checkout of `labs-app-template`
at:

    <TEMPLATE_PATH>

If that path is still the literal placeholder, is empty, or doesn't look like a
`labs-app-template` checkout (no `src/lib/utils/next-errors.ts`, no `docs/template/ROUTING.md`),
**stop and ask me for the correct path before doing anything else.** Also remind me
that I should have pulled the **latest** template into that directory, and tell me its
version (`package.json` `version` / latest git tag) so I know how current it is.

### Who I am

Assume I may **not** be a developer. **You** own the git branch. Explain what you
changed in plain language. Do not assume I can fill gaps myself.

### Operating principles (read these before touching anything)

1. **The template is the reference design, not a literal source to copy.** Forks have
   diverged differently. Match the template's **model, conventions, and security
   posture** — but adapt to how *this* app is actually structured. **If this app has
   no equivalent paradigm for something here, lean toward the template's reference
   architecture** rather than inventing a new one.
2. **Above all, do not break this app.** A working app beats a broken one. If a clean
   change isn't possible, do the safest partial version and tell me what you skipped.
3. **Copy verbatim only where it's clearly safe** (a new self-contained file that
   doesn't already exist here). Where this app already has its own version, port the
   *pattern* into the existing file rather than overwriting it.
4. **Surface every deviation** from the template and why.
5. **My libraries may differ from the template's.** Adapt to what's here; don't
   blindly change versions (see principle 7).
6. **Reuse shared infrastructure — never duplicate it per app.** (Not really relevant
   to this pure-code change, but holds in general.)
7. **Keep libraries and patterns reasonably current — toward this template, not the
   bleeding edge.** A goal of the template is for apps to stay reasonably up to date.
   Prefer the versions and patterns in the reference template over staying on very old
   ones — but do **not** bump a dependency to the newest *public* release just because
   it exists. Versions newer than the template aren't validated here and carry
   supply-chain risk; the template's pinned version is the target. Flag any risky
   version change instead of silently making it.
8. **When something is genuinely complex, risky, or ambiguous and I can't answer,
   tell me to get help — don't guess.** For irreversible or high-stakes steps you're
   unsure about, stop and ask me; if I don't know either, point me to the Labs Slack
   channels **#topic-mapp-labs** or **#topic-ai-support**.

### Step 0 — Branch and assess

1. Create a git branch (e.g. `retrofit/app-router-correctness`). All work goes here.
2. Read, in the template: `<TEMPLATE_PATH>/docs/template/ROUTING.md`, and the files
   `src/lib/utils/next-errors.ts`, `src/instrumentation.ts`, `src/app/admin/error.tsx`,
   `src/lib/admin/route-ids.ts`, the error boundaries under
   `src/modules/auth/components/` (`AuthErrorBoundary.tsx`, `AdminErrorBoundary.tsx`)
   and their test `src/modules/auth/components/__tests__/error-boundaries.test.tsx`,
   and the admin shell (`src/app/admin/layout.tsx` + the `AdminLayoutClient`).
   Also read the **2026-06-19** App-Router entry in `MIGRATION.md`.
3. In **this** app, find the equivalents: custom React error boundaries, any
   `instrumentation.ts`, the `/admin` segment's `layout.tsx` and client shell, and any
   existing route-id parsing. Note which of the five sub-changes below already exist,
   don't exist, or exist in a different shape.

### The five sub-changes

Apply each that's relevant. For any you skip, say why in your summary.

**(a) Custom error boundaries must re-throw Next.js control-flow signals — LATENT BUG.**
`notFound()` and `redirect()` work by *throwing* a signal Next catches. A custom React
error boundary that catches everything swallows these and renders a generic "Something
went wrong" instead of a real 404/redirect.
- Copy `src/lib/utils/next-errors.ts` (`isNextControlFlowError`) into this app
  (matching its file layout).
- In **every custom React error boundary** in this app (class components wrapping
  content — find them; the template's live under `src/modules/auth/components/`), skip
  the signal in `componentDidCatch` and re-`throw` it from `render()`, exactly as the
  template's boundaries do.
- If this app has **no** custom error boundaries, this sub-change is moot — note that.
- Bring the template's `error-boundaries.test.tsx` (adapt to this app's boundaries).

**(b) Admin shell must not gate `{children}` on the client session — LATENT BUG.**
If this app's admin client shell renders only a spinner while
`useSession().status === "loading"`, then **no** admin page server-renders (SSR session
status is always `"loading"`), breaking deep nested routes, SEO, and TTFB.
- Make the layout **always render `{children}`**; let session state drive only the
  chrome (sidebar/topnav), never withhold content.
- Auth must stay enforced **server-side** in `src/app/admin/layout.tsx`
  (`requireAdmin()` or this app's equivalent) — do not remove that.
- If this app's admin shell already always renders children, this is moot — note it.

**(c) Server-side error logging via `onRequestError`.**
Copy `src/instrumentation.ts` (`onRequestError`). Server-render errors are stripped
from prod client bundles and otherwise never reach CloudWatch.
- **Next version gotcha:** `instrumentation.ts` / `onRequestError` is a **Next 15**
  feature (auto-detected). Check this app's Next version. If it's on Next 15+, add it
  as-is. If it's older, do **not** force it — tell me the app's Next version and that
  adopting this cleanly wants a Next-15 upgrade (which is its own decision; see
  principles 7 & 8). Adapt to this app's existing logger conventions if it has one,
  but keep the raw `console.error` fallback the template uses (it must emit even when
  the structured logger isn't initialized).

**(d) Graceful admin error page.**
Copy `src/app/admin/error.tsx` (Retry / Reload / Back boundary; also handles
post-deploy RSC/server-action skew). Restyle to match this app's design system. Note:
this framework-managed `error.tsx` does **not** need the `isNextControlFlowError`
guard — Next never routes control-flow signals to it. If this app's admin segment is
shaped differently (or there's no `/admin`), place the equivalent route-level error
boundary where it belongs, or note that it doesn't apply.

**(e) Routing convention + `parseRouteId` helper (foundation only).**
Copy `src/lib/admin/route-ids.ts` (the dependency-free `parseRouteId` + the documented
scope-field guardrail rule) and `docs/template/ROUTING.md` into this app (as
`docs/ROUTING.md`, or `docs/template/ROUTING.md` in apps on the 2026-10-17 docs layout).
- **Install the convention + helper only.** The actual companies/workspaces *routes*,
  schema columns, and boundary resolvers arrive **with the Client Catalog capability**
  (a later retrofit), and the catalog-item layer with **UPC** — mirroring how the
  template ships it (base = convention + helper; routes = capability). Do **not** build
  routes here.

### Step 1 — Verify and hand back

- Run this app's typecheck, lint, and tests. Fix anything your changes broke.
- Sanity-check that `notFound()` / `redirect()` now reach the framework (a 404 route
  renders the real 404, not the generic error card) and that an admin page
  server-renders its content rather than only a client spinner.
- **Do not deploy.** There is no migration to run for this entry.

### Record state

Before the handback, write/update **`.retrofit-state.json` at this app's repo root**
(create it if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert this retrofit under `retrofits["2026-06-19-app-router-routing-convention"]` with
`status` (applied / partial / skipped / not-applicable), `templateVersion` +
`templateRef` (the template version and exact git tag/SHA you worked against), an
ISO-8601 UTC `at` (`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, `notes` + any `deviations`, and
the `capability` id if this retrofit maps to one. Refresh
`template.lastRetrofitAgainstVersion` / `lastRetrofitAgainstRef` / `lastRetrofitAt`;
don't remove other entries.

Then give me a **plain-language handback**:
1. Which of the five sub-changes you applied, and which you skipped (and why — e.g.
   "no custom error boundaries here", "already always renders children", "on Next 14,
   instrumentation deferred").
2. Any **deviations** from the template and why.
3. The **Next version** of this app, and whether (c) was applied or deferred.
4. What a technical person should review before this ships (it can ship without a
   migration or deploy-config change, but should still be reviewed and tested).
5. If anything here got complicated and I didn't have an answer, remind me I can ask
   in **#topic-mapp-labs** or **#topic-ai-support**.

## PROMPT END
