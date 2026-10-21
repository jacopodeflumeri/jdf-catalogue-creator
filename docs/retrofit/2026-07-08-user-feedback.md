# Retrofit prompt — User Feedback (in-app widget → shared Notion database)

> Implements the **2026-07-08 "User feedback capability"** entry in
> [`MIGRATION.md`](../../MIGRATION.md).
>
> **Optional.** Only adopt if you want authenticated users to send feedback
> (bug reports, feature requests, ratings) from inside the app. If you don't,
> skip it; nothing breaks. **Additive — no Prisma schema changes** (Notion is the
> system of record). **No LLM runs in the app** — a separate centralized Notion
> agent does triage; this retrofit never adds LLM code or credentials.
>
> Secrets are **shared** across all Labs apps (one Notion token + one database),
> so this wires the app to a shared SSM path — it does **not** create per-app
> Notion secrets.

---

## How to use this prompt

1. Pull a **fresh copy of `labs-app-template`** into a separate directory.
2. Open **your app** in your agent.
3. Replace `<TEMPLATE_PATH>` below, then paste **PROMPT START** → **PROMPT END**.

```
<TEMPLATE_PATH> = /absolute/path/to/your/fresh/labs-app-template
```

---

## PROMPT START

You are wiring the template's **User Feedback** capability into the **current
project** (an existing Mapp Labs app): a floating feedback widget that writes each
submission straight to a shared Notion "App Feedback" database. Reporter identity,
app name, responsible person, and company are auto-filled. There is **no database
model** and **no LLM call** anywhere in the app.

The authoritative reference is a fresh checkout of `labs-app-template` at:

    <TEMPLATE_PATH>

If that path is the literal placeholder, empty, or not a `labs-app-template`
checkout (no `src/modules/user_feedback/`, no
`docs/template/capabilities/USER_FEEDBACK.md`), **stop and ask me for the correct path.**
Also remind me to have pulled the **latest** template, and tell me its version.

### Who I am

Assume I may **not** be a developer and cannot run AWS/SSM/Notion admin actions
myself. **You** own the git branch and wire things up; creating the SSM
parameters, sharing the Notion database, adding the Notion `Company` column, and
deploying are steps for me or a technical person. Explain everything in plain
language.

### Is this for my app? (decide first)

This is **optional**. Ask me: **do you want authenticated users to be able to send
feedback (bug reports, feature requests, ratings) from inside the app**, collected
into the shared Mapp Labs Notion "App Feedback" database?
- **No** → tell me it doesn't apply and stop. Don't wire it up "just in case."
- **Yes** → proceed.

### Operating principles (read before touching anything)

1. **The template is the reference design, not a literal source to copy.** Match
   its model/conventions; adapt to this app. **No equivalent paradigm → lean toward
   the template's reference architecture.**
2. **Above all, do not break this app.** Safest change over a risky one.
3. **Copy verbatim only where clearly safe;** otherwise port the *pattern*.
4. **Surface every deviation** and why.
5. **Reuse shared infrastructure — never duplicate per app.** There is **one**
   shared Notion "App Feedback" database and **one** shared Notion token for all
   Labs apps, stored at shared SSM `/labs-shared/feedback/*`. Do **not** create a
   per-app Notion database or per-app secrets, and do **not** point the app at a
   different database.
6. **Do NOT add any LLM code or credentials.** Triage/categorization/the weekly
   digest are handled by a **centralized Notion agent**, deliberately outside the
   app. If you find yourself adding `@anthropic-ai/sdk`, LiteLLM, or a
   `/api/feedback/triage` route, stop — that's out of scope by design (see the
   "Why no in-app LLM" section of `docs/template/capabilities/USER_FEEDBACK.md`).
7. **When something is genuinely complex/risky/ambiguous and I can't answer, tell
   me to get help — don't guess.** Stop and ask; if I don't know, point me to
   **#topic-mapp-labs** / **#topic-ai-support**.
8. **Converge to the reference architecture, and clean up what you replace —
   scoped to this app, never overreaching.** Propose AWS/Notion changes as a
   reviewable checklist; never auto-run them.

### Step 0 — Branch, read, assess

1. Create a git branch (e.g. `retrofit/user-feedback`). All work goes here.
2. Read, in the template: `docs/template/capabilities/USER_FEEDBACK.md`, the whole
   `src/modules/user_feedback/` module + its `scaffold/README.md`, the
   `user_feedback` entry in `docs/template/capabilities/_registry.json`, and the
   **2026-07-08** entry in `MIGRATION.md`.
3. In **this** app, find: the root layout (`src/app/layout.tsx` or equivalent) and
   its providers; how the app reads the current session (this template exposes
   `@/modules/auth/server` with `getAdminSession` / `getCustomerSession` /
   `getUserDisplayName` / `getUserEmail` / `resolveCompanyContext` — if this app's
   auth differs, adapt to whatever gives you the user's name + email, and company
   context if it has any); how the app injects secrets from SSM into the container
   (ECS task definition secrets); and whether `app.config.json` has `createdBy` set.

### Step 1 — Bring in the module + scaffold

1. Copy `src/modules/user_feedback/` (the compiled `lib/` + `index.ts`, **and** the
   `scaffold/` directory) into this app. Adapt imports to this app's conventions
   (`logger`, the `@/` alias, how it reads `app.config.json`). The module makes no
   LLM call — keep it that way.
2. `npm install @notionhq/client` (add to `package.json`).
3. Copy the two scaffold `.example` files into place (drop `.example`):
   - `scaffold/components/feedback/FeedbackWidget.tsx.example` →
     `src/components/feedback/FeedbackWidget.tsx`
   - `scaffold/app/api/feedback/route.ts.example` → `src/app/api/feedback/route.ts`
   Adapt the route's auth imports to this app if its auth module differs. The route
   must accept any authenticated user and auto-fill name/email/company from the
   session — the client only ever sends `{ category, comment, rating }`.

### Step 2 — Mount the widget

Mount `<FeedbackWidget />` **once** in the root layout, inside the providers, so it
appears on every page. The widget renders on the client; the route enforces auth.
Confirm the rating is shown only for the "Give feedback" category and that the
comment field caps at 2000 characters.

### Step 3 — Wire secrets + registry/docs

1. **Secrets:** wire `NOTION_API_KEY` and `NOTION_FEEDBACK_DATABASE_ID` into the
   container as ECS **secrets** sourced from the **shared** SSM parameters
   `/labs-shared/feedback/NOTION_API_KEY` and
   `/labs-shared/feedback/NOTION_FEEDBACK_DATABASE_ID`, and grant the task role
   `ssm:GetParameter` (+ `kms:Decrypt`) on `/labs-shared/feedback/*`. Match how this
   app already injects other SSM-backed secrets; **prepare** the CDK change but do
   **not** deploy. For local dev, add the two vars (commented) to `.env.example`.
2. Bring the template's `docs/template/capabilities/USER_FEEDBACK.md` into this app's
   capability docs (`docs/capabilities/`, or `docs/template/capabilities/` in apps on the 2026-10-17 docs layout),
   add the `user_feedback` entry to the `_registry.json` there if this app keeps one, add the `.env.example`
   stubs, and add the option to `scripts/setup.sh` if this app has that selector.
3. Ensure `app.config.json` `createdBy` is set — it becomes "Responsible Person" on
   every row. If it's empty, ask me who the app builder/owner is.
4. Add `"user_feedback"` to `enabledCapabilities` in `app.config.json`.

### Human steps (you prepare; you do NOT run these)

Give me an ordered checklist — **do not run AWS/SSM/Notion or deploy yourself**:
1. Create the shared SSM SecureStrings `/labs-shared/feedback/NOTION_API_KEY` and
   `/labs-shared/feedback/NOTION_FEEDBACK_DATABASE_ID` **if they don't already
   exist** (they're shared across all Labs apps — check first; don't duplicate).
2. In Notion, **share the "App Feedback" database with the integration** so the
   token can write to it. The shared database already has every column (including
   `Company`), so no Notion schema change is needed.
3. `make <env>-infra-deploy` (applies the task-role SSM grant + injects the two
   secrets).
4. Deploy the app, sign in, and submit a test feedback entry — confirm a new row
   appears in the Notion database with App Name, Responsible Person, User
   Name/Email, Company (for a company-context customer), and `Triage Status =
   pending`.

### Verify and hand back

- Run typecheck/lint/tests; fix what your changes broke. **Do not deploy.**
- Confirm you added **no** LLM dependency or triage/digest route.

### Record state

Before the handback, write/update **`.retrofit-state.json` at this app's repo
root** (create it if absent), following
`<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`. Upsert this retrofit under
`retrofits["2026-07-08-user-feedback"]` with `status` (applied / partial /
skipped / not-applicable — use `not-applicable` if I said this app doesn't want
in-app feedback), `templateVersion` + `templateRef` (the template version and
exact git tag/SHA you worked against), an ISO-8601 UTC `at`
(`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, `notes` + any `deviations`, and
`capability: "user_feedback"`. Refresh `template.lastRetrofitAgainstVersion` /
`lastRetrofitAgainstRef` / `lastRetrofitAt`; don't remove other entries.

Then give me a **plain-language handback**:
1. Whether this applies (I want in-app feedback) — or that we decided it doesn't.
2. What you changed (module + scaffold copied in, widget mounted, route wired,
   secrets/registry/docs).
3. The **auto-filled** columns (App Name, Responsible Person from `createdBy`, User
   Name/Email, Company, Submitted At) vs the three the user provides (category,
   comment, and rating for general feedback only).
4. The **shared** nature of the Notion secrets (one SSM path for all apps) — and
   that you added no per-app secret and no LLM.
5. The ordered **human checklist** (SSM params → share Notion DB → deploy → test
   submission).
6. Every **deviation** from the template and why.
7. If anything got complicated and I didn't have an answer, remind me I can ask in
   **#topic-mapp-labs** / **#topic-ai-support**.

## PROMPT END
