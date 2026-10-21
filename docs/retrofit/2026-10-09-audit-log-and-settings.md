# Retrofit prompt — Admin audit log and a Settings link

> Implements the **2026-10-09 "Admin audit log and a Settings link in the sidebar"**
> entry in [`MIGRATION.md`](../../MIGRATION.md).
>
> **Applies to every fork.** Gives the app a real audit log — *who changed what, and
> when* — at `/admin/audit-log`, and a **Settings** entry in the admin sidebar so the
> standard admin pages are reachable. **One additive table + a small module + one
> page. No SSM, no infra.**

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

You are adding an **admin audit log** to the **current project** (an existing Mapp
Labs app), and making the admin **Settings** page reachable from the sidebar. The
audit log records who changed what, and when; admins read it at `/admin/audit-log`.

The authoritative reference implementation is a fresh checkout of `labs-app-template`
at:

    <TEMPLATE_PATH>

If that path is still the literal placeholder, is empty, or doesn't look like a
`labs-app-template` checkout (no `src/modules/audit/write.ts`, no
`prisma/migrations/20261009130000_audit_log/`), **stop and ask me for the correct path
before doing anything else.** Also remind me I should have pulled the **latest**
template into that directory, and tell me its version.

### Who I am

Assume I may **not** be a developer. **You** own the git branch and the database
migration file. Explain what you changed in plain language. Do not assume I can fill
gaps myself.

### Operating principles (read these before touching anything)

1. **The template is the reference design, not a literal source to copy.** Match its
   model and conventions, but adapt to the app you find.
2. **Above all, do not break this app.** If a clean change isn't possible, do the
   safest partial version and tell me what you skipped.
3. **Copy verbatim only where it's clearly safe** (the `audit` module, the read
   service, the page, the tests). In files this app has changed — the sidebar config,
   the settings page, server actions — port the *pattern*.
4. **If this app already has an audit log of its own, keep it.** See Step 0.3. Never
   replace a working audit trail, and never drop or rewrite its data.
5. **Surface every deviation** from the template and why.
6. **Never apply a migration to a remote database and never deploy.** You create the
   migration file and may apply it to my **local** dev database only.
7. **Follow the design system.** Read `<TEMPLATE_PATH>/docs/template/DESIGN-SYSTEM.md` before
   changing any UI. Use existing components and tokens.
8. **When something is ambiguous and I can't answer, tell me to get help — don't
   guess.** Point me to **#topic-mapp-labs** or **#topic-ai-support**.

### Step 0 — Branch and assess

1. Create a git branch (e.g. `retrofit/audit-log`). All work goes here.
2. Read, in the template: `docs/template/capabilities/AUDIT_LOG.md`, everything in
   `src/modules/audit/`, `src/lib/prisma/services/audit-log.ts`,
   `src/app/admin/audit-log/`, the audit calls in
   `src/lib/actions/admin/access-management-actions.ts`, and the **2026-10-09** audit
   log entry in `MIGRATION.md`.
3. **Does this app already have an audit log?** Check:

   ```bash
   grep -n "model AuditLog" prisma/schema.prisma
   grep -rn "writeAuditLog\|auditLog\." src --include="*.ts" --include="*.tsx" | head
   ls src/app/admin/audit-log 2>/dev/null
   ```

   - **Nothing found** → the normal case. Continue with Step 1.
   - **It has its own `AuditLog` model, writer, or page** → **do not overwrite any of
     it.** Compare it to the template's and tell me the differences. The template's
     model is deliberately a subset of the usual shape, so the likely outcome is:
     keep this app's model, writer and page; add only the `actorEmail` column (the
     template's migration does exactly that to an existing table, and nothing else);
     and do Step 3 (Settings link). Ask me before changing anything beyond that.
4. **List this app's admin mutations** — the server actions and API routes that
   create, change or delete something on behalf of an admin:

   ```bash
   grep -rln "requireAdmin(" src --include="*.ts" --include="*.tsx"
   ```

   Group them by the thing they change (e.g. "API keys", "accounts", "import jobs")
   and show me the list. **This is the real work of this retrofit**, and I decide what
   is worth recording — see Step 4.

### Step 1 — Table and migration

1. Add the `AuditLog` model from the template's `prisma/schema.prisma` (keep its
   comment), and add `auditLogs AuditLog[]` to the `MappTeam` model.
2. Copy the template's `prisma/migrations/20261009130000_audit_log/` directory. It is
   additive and idempotent, and safe over an existing `audit_log` table.
3. If I have a local dev database, apply it there and run `npx prisma generate`.
   **Do not touch staging or production.**
4. Confirm there is no drift: the migration must contain **only** the new table, its
   indexes and its foreign key. If Prisma proposes anything else — in particular
   dropping `mapp_team_email_lower_idx` — do not accept it.

### Step 2 — Module, service, page

1. Copy `src/modules/audit/` (including its tests).
2. Copy `src/lib/prisma/services/audit-log.ts` and register it in the services index
   the way this app registers its other services (`prismaService.auditLog`).
3. Copy `src/app/admin/audit-log/`. It must stay readable by any active admin:
   `await requireAdmin({})`.
4. If this app's DB tests truncate a hardcoded table list, add `audit_log` to it.
5. Confirm `/admin/audit-log` is in this app's route access map, if it has one
   (`src/modules/auth/utils/access-control.ts` in the template), at `viewer`.

### Step 3 — Settings link

1. Add a **Settings** entry pointing at `/admin/settings` to the end of this app's
   admin sidebar items (`ADMIN_NAVIGATION_ITEMS` in the template's
   `src/modules/navigation/config/navigation-items.tsx`). It must be visible to
   **every** admin, not only admin-level ones — the page filters its own cards.
2. Check the settings page has an **Audit Log** card pointing at `/admin/audit-log`.
   If this app has no `/admin/settings` page at all, copy the template's.
3. **Mapp Team moves into Settings.** Once the Settings page shows a working **Mapp
   Team** card, remove the Mapp Team entry from the sidebar
   (`ADMIN_NAVIGATION_ADMIN_ITEMS` in the template, now an empty list) and port the
   template's `adminAccessItems.length > 0` guard into the sidebar component so an
   empty section leaves no stray divider. If this app has put **its own** entries in
   that list, leave those where they are and tell me.
4. If this app has other admin pages that are not reachable from any menu, tell me —
   a card on Settings is usually the right home, but ask before adding them.

### Step 4 — Record changes

1. **Mapp Team access changes.** Port the `auditAccessChange` helper and its four
   calls from the template's `access-management-actions.ts`.
2. **This app's own mutations**, from the Step 0.4 list. Read "What to record" in
   `<TEMPLATE_PATH>/docs/template/capabilities/AUDIT_LOG.md` and use it to sort the list into
   **consequential** (record) and **not** (skip) — it does not need to be everything.
   Show me the sorted list with a one-line reason each. For each group I approve:
   - add one line to `AUDIT_ENTITY_TYPES` in `src/modules/audit/entity-types.ts`
     (snake_case key, a label, and an `href` if the thing has an admin page);
   - call `writeAuditLog` **after** the change succeeds, with a `message` a
     non-developer would understand ("API key 'Reporting' revoked", not "update ok").
3. Rules — these matter more than coverage:
   - **Never put secrets in `message` or `data`**: tokens, passwords, API keys, full
     request bodies. Every admin, including viewers, can read the page.
   - **Inside `prisma.$transaction`, use `writeAuditLogTx(tx, …)`** so the row rolls
     back with the change.
   - **A bulk action writes one row per record changed.**
   - **Do not** wrap `writeAuditLog` in `try/catch`; it never throws.
   - **Do not** record reads, page views or logins here.
4. If the list is long, do the access-control and destructive actions first and tell
   me what is left. A partly covered audit log is useful; a broken app is not.
5. **Make it stick.** Copy the audit-log guidance from the template's `AGENTS.md`
   (the `audit_log` row in the capabilities table and step 5 under "When adding new
   server actions") into this app's agent instructions, so that whoever builds the
   next feature records its consequential changes as part of that work.

### Step 5 — Tests

Copy `src/modules/audit/__tests__/write.test.ts`,
`src/lib/prisma/services/__tests__/audit-log.db.test.ts` and
`src/lib/actions/admin/__tests__/access-management-audit.test.ts`, adapting mocks.
Existing tests that mock `@/lib/prisma/services` or the access actions may need the
new module mocked too. Run type-check, lint and the unit tests; run the DB tests if I
have a local database.

### Guardrails (do NOT do these)

- Do **not** drop, rename or rewrite an existing `audit_log` table or its rows.
- Do **not** make the audit log writable or deletable from the UI.
- Do **not** add automatic pruning. Retention is my decision.
- Do **not** try to capture changes "automatically" with Prisma middleware or
  extensions. It records row churn without intent, and it catches secrets.
- Do **not** apply the migration to a remote database, and do **not** deploy.

### Verify and hand back

- Type-check, lint and tests pass. Paste the test summary.
- If I can run the app locally (`DEV_AUTH_ENABLED=true`, `/auth/dev`): log in as an
  admin, confirm **Settings** is in the sidebar, open **Settings → Audit Log**, change
  a team member's access level on Mapp Team, and confirm the change appears.

### Record state

Before the handback, write/update **`.retrofit-state.json` at this app's repo root**
(create it if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert this retrofit under `retrofits["2026-10-09-audit-log-and-settings"]` with
`status` (applied / partial / skipped / not-applicable), `templateVersion` +
`templateRef`, an ISO-8601 UTC `at` (`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, `notes` +
any `deviations`, and `capability: "audit_log"`. Use `partial` if some of this app's
mutations are not yet recorded, and list them in `notes`. Refresh
`template.lastRetrofitAgainstVersion` / `lastRetrofitAgainstRef` / `lastRetrofitAt`;
don't remove other entries.

Then give me a **plain-language handback**:

1. Whether this app already had an audit log, and what you did about it.
2. What is now recorded, and **what is not yet** (the mutations you left for later).
3. Any **deviations** from the template and why.
4. **How to ship it:** the ordinary `make staging-deploy` — the migration is additive,
   so the maintenance deploy is **not** needed. Remind me that bumping the version
   first is recommended.
5. **What to expect:** the log starts empty and fills from the deploy onwards; for
   the few minutes between the new version starting and the migration finishing, the
   Audit Log page shows an error and changes are not recorded.
6. **What to check on staging:** Settings is in the sidebar; Settings → Audit Log
   opens; a team-member access change shows up with my name against it.
7. If anything got complicated and I didn't have an answer, remind me I can ask in
   **#topic-mapp-labs** or **#topic-ai-support**.

## PROMPT END
