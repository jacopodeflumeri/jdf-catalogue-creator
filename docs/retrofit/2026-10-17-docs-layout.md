# Retrofit prompt — Docs layout (`docs/` for the app, `docs/template/` for the template)

> Implements the **2026-10-17 "Docs layout"** entry in [`MIGRATION.md`](../../MIGRATION.md).
>
> **Optional, docs-only — worth taking.** In apps built from older templates, the
> template's reference docs and the app's own docs sit side by side in `docs/`, so
> neither people nor agents can tell which is which, and agents stop writing app docs
> because `docs/` already "looks done". This retrofit moves the template-owned docs into
> `docs/template/`, keeps the app's own docs at `docs/`, adds a `docs/README.md` index,
> and adds the AGENTS.md rules for documenting work. **Docs, comments and strings only:
> no code behaviour, no migration, no SSM, no infra, no deploy.**

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

You are reorganising the **docs** of the **current project** (an existing Mapp Labs
app) so that docs shipped by the template live in `docs/template/` and the app's own
docs live in `docs/`. This is **docs, comments and user-facing strings only** — you
change no code behaviour, no schema, no SSM and no infra.

The authoritative reference is a fresh checkout of `labs-app-template` at:

    <TEMPLATE_PATH>

If that path is still the literal placeholder, is empty, or doesn't look like a
`labs-app-template` checkout (no `docs/template/README.md`, no `docs/README.md`),
**stop and ask me for the correct path before doing anything else.** Also remind me I
should have pulled the **latest** template into that directory, and tell me its version.

### Who I am

Assume I may **not** be a developer. **You** own the git branch. Explain what you
changed in plain language. Do not assume I can fill gaps myself.

### Operating principles (read these before touching anything)

1. **Move, don't refresh.** The app's copies of the template docs describe *this*
   app's code at the template version it was built from. Move them with `git mv` so
   their content and history survive. Do **not** replace them with the template's
   newer versions: those can describe features this app hasn't retrofitted yet, which
   misleads agents. Newer content arrives with the feature retrofits.
2. **Never lose app-written content.** Anything the app's team wrote — whole files,
   or sections added inside a template doc — stays the app's, at `docs/`.
3. **Classify by comparison, and ask when unsure.** Don't guess from file names alone.
4. **Surface every deviation** from the template and why.
5. **When something is ambiguous and I can't answer, tell me to get help — don't
   guess.** Point me to **#topic-mapp-labs** or **#topic-ai-support**.

### Step 0 — Branch and assess

1. Create a git branch (e.g. `retrofit/docs-layout`). All work goes here.
2. Read, in the template: `docs/README.md`, `docs/template/README.md`, the
   "Documenting Your Work" and "App Notes and Pitfalls" sections of `AGENTS.md`, and
   the **2026-10-17** entry in `MIGRATION.md`.
3. If this app already has `docs/template/`, it is on the new layout: tell me, check
   only Steps 3–4 for gaps, and stop.
4. List every file under this app's `docs/` (recursively), excluding `docs/retrofit/`.

### Step 1 — Classify each doc

For each file, decide **template-owned**, **app-owned**, or **mixed**:

**Template-owned** — these names were shipped by the template (older names in
parentheses):

| In this app (old layout) | New location |
|---|---|
| `docs/APP-BRANDING.md` | `docs/template/APP-BRANDING.md` |
| `docs/COST_ALLOCATION.md` | `docs/template/COST_ALLOCATION.md` |
| `docs/CUSTOMIZATION.md` | `docs/template/CUSTOMIZATION.md` |
| `docs/DEPLOYMENT.md` | `docs/template/DEPLOYMENT.md` |
| `docs/DESIGN-SYSTEM.md` | `docs/template/DESIGN-SYSTEM.md` |
| `docs/ENTRA-SETUP.md` | `docs/template/ENTRA-SETUP.md` |
| `docs/INTERNAL-API.md` | `docs/template/INTERNAL-API.md` |
| `docs/INTERNAL-CA.md` | `docs/template/INTERNAL-CA.md` |
| `docs/KEYCLOAK-SETUP.md` | `docs/template/KEYCLOAK.md` |
| `docs/MONITORING.md` | `docs/template/MONITORING.md` |
| `docs/PERMISSION-LEVELS.md` | `docs/template/PERMISSION-LEVELS.md` |
| `docs/ROUTING.md` | `docs/template/ROUTING.md` |
| `docs/LOCAL-POSTGRES.md` | `docs/template/LOCAL-POSTGRES.md` |
| `docs/capabilities/` (whole directory, incl. `_registry.json`) | `docs/template/capabilities/` |
| `docs/DATA-SYNC.md` | merged into `docs/template/capabilities/DATA_SYNC.md` |
| `docs/HACKATHON_QUICKSTART.md` | removed; content now in `docs/template/KEYCLOAK.md` + `docs/template/TROUBLESHOOTING.md` |
| `docs/KEYCLOAK-URI-AUTO-REGISTRATION.md` | removed; content now in `docs/template/KEYCLOAK.md` (app side) and `docs/template/platform/` (platform side) |
| `docs/COST_TAGGING_PROMPT.md` | `docs/template/platform/COST_TAGGING_PROMPT.md` |
| `docs/KEYCLOAK-MIGRATION.md` | `docs/retrofit/KEYCLOAK-MIGRATION.md` |

**App-owned** — anything not in that table, or a file the app's team clearly wrote
(feature docs, decision records, runbooks for app-specific integrations).

**Mixed** — a template-owned file the app has edited with app-specific content. Find
these by diffing against the template's version from around the app's fork, e.g.
`git log --follow -p -- docs/DEPLOYMENT.md` in this app, or a diff against the same
file in `<TEMPLATE_PATH>` (allow for the template having moved on since). Edits that
match a template change (a retrofit applied here) are template content; edits that
describe *this* app (its own env vars, integrations, extra deploy steps, owners) are
app content.

**Show me the classification as a table before moving anything.** For every file you
are unsure about, say why and ask me.

### Step 2 — Move

After I confirm:

1. `git mv` each template-owned file to its new location from the table. For the
   **renamed** entries (`KEYCLOAK-SETUP.md` → `KEYCLOAK.md`) rename on move.
2. For the **merged/removed** entries (`DATA-SYNC.md`, `HACKATHON_QUICKSTART.md`,
   `KEYCLOAK-URI-AUTO-REGISTRATION.md`): `git mv` them into `docs/template/` under
   their **old** names. Only replace them with the template's consolidated docs if this
   app already has the matching features at the template's current level (e.g. Data
   Sync wired, Keycloak with redirect-URI registration) — otherwise keep them as they
   are and tell me.
3. **Mixed** files: move the file to `docs/template/`, and move the app-specific
   sections out into an app doc at `docs/` (extend an existing feature doc, or create
   e.g. `docs/DEPLOYMENT-NOTES.md`). The app doc may link to the template doc it
   extends; don't add app pointers inside `docs/template/`.
4. App-owned files stay at `docs/`.
5. Do not touch `docs/retrofit/` (except receiving `KEYCLOAK-MIGRATION.md`).
6. Copy these new template docs only if what they describe exists in this app:
   `docs/template/WINDOWS.md` (only if this app's `scripts/deploy/_config.sh` has the
   Windows/Git Bash handling — otherwise tell me it's a separate catch-up),
   `docs/template/TROUBLESHOOTING.md`, `docs/template/platform/README.md`.

### Step 3 — Indexes

1. Create `docs/README.md` from `<TEMPLATE_PATH>/docs/README.md`, then list **this
   app's** docs under "This app's docs" — one line each: link + what it covers.
2. Create `docs/template/README.md` from `<TEMPLATE_PATH>/docs/template/README.md`,
   **keeping only lines for files that exist here** and adjusting names you kept (e.g.
   `KEYCLOAK-SETUP.md`).

### Step 4 — AGENTS.md (or CLAUDE.md / whatever agent file this app has)

1. Port the **"Documenting Your Work"** section from `<TEMPLATE_PATH>/AGENTS.md`
   (place it after "Scope Restriction" as the template does).
2. Add the **"App Notes and Pitfalls"** section at the end. If the app's agent file
   already carries app-specific pitfalls mixed into template sections, offer to move
   them there — ask first.
3. Point "Frontend Development Standards" at `docs/template/DESIGN-SYSTEM.md`.

### Step 5 — Update references

Grep the whole repo (excluding `node_modules`, `.git`, `.next`) for every **old** path
from the Step 1 table — both `docs/NAME.md` forms and bare relative links such as
`(DEPLOYMENT.md)` or `(../capabilities/...)` inside docs:

```bash
grep -rnE 'docs/(APP-BRANDING|COST_ALLOCATION|CUSTOMIZATION|DEPLOYMENT|DESIGN-SYSTEM|ENTRA-SETUP|INTERNAL-API|INTERNAL-CA|KEYCLOAK-SETUP|MONITORING|PERMISSION-LEVELS|ROUTING|LOCAL-POSTGRES|DATA-SYNC|HACKATHON_QUICKSTART|KEYCLOAK-URI-AUTO-REGISTRATION|COST_TAGGING_PROMPT|KEYCLOAK-MIGRATION)\.md|docs/capabilities' \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next .
```

Update them in `AGENTS.md`, `README.md`, `GETTING_STARTED.md`, `Makefile` (help text),
`scripts/**` (echo messages), `infra/**`, `src/**` **comments and strings only**,
`.env.example`, `prisma/**`, `.github/**`, and `docs/**`. Relative links inside moved
docs change depth (`../` → `../../`). Then resolve every relative markdown link in the
repo's `.md` files and fix the broken ones. Leave historical mentions in this app's own
`MIGRATION.md`/changelog alone if it has one.

Never rename or edit **code** identifiers, and never change behaviour. If `npx tsc
--noEmit` and the linter passed before, they must pass after.

### Verify and hand back

- The grep above returns only intentional historical mentions.
- No broken relative links.
- Type-check, lint and tests pass (comments only changed, but confirm).
- **Do not deploy** — nothing here needs one.

### Record state

Before the handback, write/update **`.retrofit-state.json` at this app's repo root**
(create it if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert this retrofit under `retrofits["2026-10-17-docs-layout"]` with `status`
(applied / partial / skipped / not-applicable), `templateVersion` + `templateRef` (the
template version and exact git tag/SHA you worked against), an ISO-8601 UTC `at`
(`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, and `notes` + any `deviations`. Refresh
`template.lastRetrofitAgainstVersion` / `lastRetrofitAgainstRef` / `lastRetrofitAt`;
don't remove other entries.

Then give me a **plain-language handback**:

1. The classification table (template / app / mixed) and where each file went.
2. App-specific content you moved out of template docs, and where it now lives.
3. Template docs you kept under old names instead of the consolidated versions, and why.
4. Every file whose references you updated.
5. Any **deviations** from the template and why.
6. Confirmation that no code behaviour, migration, SSM or infra change was made.
7. If anything got complicated and I didn't have an answer, remind me I can ask in
   **#topic-mapp-labs** or **#topic-ai-support**.

## PROMPT END
