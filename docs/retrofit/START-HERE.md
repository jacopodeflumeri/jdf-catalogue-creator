# Retrofit — Start Here (orchestrator prompt)

This is the **entry point** for bringing an existing Mapp Labs app (forked from
`labs-app-template` at some point in the past) up to date with the current template.

You do **not** need to know which changes apply to you, or in what order. This prompt
tells an agent to figure that out, propose a plan, and apply the changes **one at a
time** — checking with you before each, and without breaking your app.

## What you do (3 steps)

1. **Download the latest `labs-app-template`** from GitHub into a *separate*
   directory (do **not** overlay it on your app). This is the reference the agent
   reads from.
2. **Open your own app** (the one being upgraded) in your coding agent.
3. **Paste the prompt below**, after replacing `<TEMPLATE_PATH>` with the path to the
   fresh template checkout.

```
<TEMPLATE_PATH> = /absolute/path/to/your/fresh/labs-app-template
```

You may be asked questions as it goes (especially "do you want this capability?").
That's expected. When it finishes a step it will explain, in plain language, what it
changed and what a technical person needs to check before it ships.

---

## PROMPT START

You are upgrading the **current project** — an existing Mapp Labs app that was forked
from `labs-app-template` some time ago — toward the current template. A fresh checkout
of the latest `labs-app-template` is at:

    <TEMPLATE_PATH>

If that path is still the literal placeholder, is empty, or doesn't look like a
`labs-app-template` checkout (no `MIGRATION.md`, no `docs/retrofit/`, no
`src/modules/`), **stop and ask me for the correct path before doing anything else.**
Also remind me that I must have pulled the **latest** version of the template into
that directory — confirm its version (`package.json` `version` / latest git tag) and
tell me what it is, so I know how current my reference is.

### Who I am

Assume I may **not** be a developer. I likely do not know how to use git branches or
run database migrations. **You** own those mechanics. Explain things in plain
language. Do not assume I can fill gaps myself.

### Operating principles (these apply to every change you make)

1. **The template is the reference design, not a literal source to copy.** Forks have
   diverged differently. Match the template's **model, conventions, and security
   posture** — but adapt to how *this* app is actually structured.
2. **Above all, do not break this app.** A working app on older patterns beats a
   broken app on new ones. If a clean change isn't possible, do the safest partial
   version and tell me what you skipped and why.
3. **One change at a time.** Never batch multiple migration entries into one sweep.
   Apply one, verify, summarize, and pause before the next.
4. **Reuse SHARED infrastructure — never duplicate it per app.** Shared Keycloak
   clients, shared SSM parameters (`/labs/*`, `/labs-prod/*`), shared IdP hints, the
   vendored internal root CA, and the shared internal-API `s2s` credential are shared
   across *all* Labs apps. Changing one should never mean touching 50 apps. If you're
   about to mint something that looks shared, stop and find the shared one.
5. **Surface every deviation.** Whenever you do something differently from the
   template because its exact approach would break this app, say so.
5a. **Never apply an "operational runbook" entry inline — not even its code part.**
   A few entries are not code-catch-ups; they are **stateful, destructive operations
   runbooks** that require live `deploy` + database backup/restore choreography with a
   human at the keyboard. The **shared-VPC migration**
   (`2026-03-25-shared-vpc-migration.md`) is one: flipping `vpcId` in code *looks* like
   a one-line change, but on the next deploy CloudFormation **replaces the RDS instance**
   — so making that edit without the runbook's backup-first choreography is a latent
   **data-loss landmine**. For any such entry: do **not** make the change (not even the
   code edit), do **not** stage it on the branch. Record it in the plan as **deferred —
   run standalone**, and tell me to run its dedicated prompt myself, deliberately, as a
   separate supervised session. The README index flags these as ⚠️ operational runbooks.
6. **Branch, don't deploy, don't auto-apply migrations.** Work on a branch; generate
   database migrations but never run them against a database; never deploy.
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
9. **Converge to the reference architecture, and clean up what you replace — scoped to
   this app, never overreaching.** The goal is to bring this app *in line with the
   template*, even where the current setup "works" (a pre-template pattern that still
   functions is still a deviation to converge). When a change makes old config or
   credentials obsolete, remove **this app's own** dead config and *propose* removing
   its now-dead per-app SSM params as reviewable, scoped commands — don't auto-delete.
   **Never** touch shared infrastructure, shared credentials/clients, or any *other*
   app's resources, and never deprovision something just because this app stopped using
   it (that's a labs-platform decision). Do not reference other apps by name.

### Step 1 — Establish the baseline (where this fork is today)

1. Create a git branch for this work (e.g. `retrofit/catch-up`). All work goes here.
2. Read `<TEMPLATE_PATH>/MIGRATION.md` (entries are newest-first) and
   `<TEMPLATE_PATH>/docs/retrofit/README.md` (the index of retrofit prompts and their
   dependency order).
3. Figure out **roughly when this fork diverged**: ask me if I know my fork date;
   otherwise infer a lower bound from this app's first commit
   (`git log --reverse --format='%aI' | head -1`). Treat this as a *hint*, not truth.
4. **Read `.retrofit-state.json` at the repo root if it exists.** It records what prior
   retrofit runs applied / skipped / deferred (and why), against which template version
   — your primary "where did I leave off" signal. See
   [docs/retrofit/RETROFIT-STATE.md](RETROFIT-STATE.md). Treat it as a strong hint.
5. **Inspect the code to confirm what's actually applied.** The fork date and the state
   file are hints — the source of truth is whether each change is present in *this* app
   (does the file/feature/env var/schema column exist?). Reconcile against
   `.retrofit-state.json`; if they disagree, trust the code and note the discrepancy.
   Classify each post-fork MIGRATION.md entry as **already applied**, **not applied**,
   or **partially applied**.

### Step 2 — Build the plan (ordered, dependency-aware)

Produce an ordered to-do list of the **not-applied / partially-applied** entries.
Order them so that **prerequisites come first** — use the dependency notes in
`docs/retrofit/README.md`. Generally this means roughly chronological order, but a
capability's prerequisites must always precede it even if listed later.

For each entry, classify it as either:

- **Mandatory (foundational / correctness).** App-Router fixes, routing conventions,
  CA trust, error-boundary fixes, infra correctness — things that fix latent bugs or
  that other changes depend on. These apply regardless of which features I want.
- **Optional (a capability).** Something the app only needs if it uses that feature
  (e.g. Client Catalog, UPC, Data Sync, LLM, Company Login).

**Show me this plan before applying anything.** For each optional capability, **ask me
whether I want it.** Important nuance: if I decline an optional capability but later
want something that *depends* on it, that dependency becomes required — explain that
to me rather than silently skipping or silently pulling it in. If a mandatory item is
a prerequisite for an optional one I *do* want, include it and tell me why.

Some "optional" capabilities are **assumed by the template's future direction** (most
notably the companies/workspaces/access model). If I decline one of these, **tell me
plainly that I'm accruing divergence debt** — future template updates assume it's in
place, so I'll likely be asked to converge later. Declining should be a deliberate
choice with a good reason, not a default.

**Seed `.retrofit-state.json` now** — before applying anything — so even an app that has
none of this yet immediately gets a tracked baseline. Create it at the repo root if
absent: fill `schemaVersion`, `template` (repo + the version **and** git tag/SHA you're
running against, plus `forkedAt*` if you can determine it), and `app.name`. Then add a
`retrofits` entry for **every** post-fork item with its baseline status: `applied`
(already present in this app — note "pre-existing; detected, not applied by this run"),
`not-applicable`, `skipped` (declined), or `pending` (in the approved plan, not yet
done). You'll flip each `pending` → `applied`/`partial` as you complete it in Step 3.
See [docs/retrofit/RETROFIT-STATE.md](RETROFIT-STATE.md).

### Step 3 — Apply, one at a time

For each item in the approved plan, in order:

0. **Is this an operational runbook?** If the entry is flagged ⚠️ in the README index
   or its prompt says it deploys / does destructive stateful ops (the shared-VPC
   migration is the current example), **skip applying it here** per principle 5a — leave
   it deferred, remind me to run its standalone prompt myself, and move to the next item.
   Do not make its code change as part of this sweep.
1. **Find the right instructions.**
   - If `<TEMPLATE_PATH>/docs/retrofit/` has a dedicated prompt for this entry (see
     its README index), **follow that prompt** — it has the detailed, adapted steps.
   - If there's no dedicated prompt, **follow the steps in the matching MIGRATION.md
     entry directly** (small entries are handled this way).
2. Apply the change, adapting to this app per the operating principles above.
3. Bring any relevant **tests** and make them pass. Run typecheck/lint.
4. **Generate** (do not apply) any database migration; leave it staged for review.
5. **Record state.** Update `.retrofit-state.json` (create it if absent) — upsert this
   item's entry under `retrofits[<id>]` with `status`
   (applied/partial/skipped/not-applicable), the template version, an ISO-8601 UTC
   timestamp, and `notes`/`deviations` for anything that didn't follow the template
   exactly; refresh `template.lastRetrofitAgainstVersion`/`lastRetrofitAt`. See
   [docs/retrofit/RETROFIT-STATE.md](RETROFIT-STATE.md). (A dedicated prompt has its own
   record-state step; for an inline MIGRATION-only entry, you record it here.)
6. **Stop and report** in plain language: what you changed, any deviations, what a
   technical reviewer must check, and what's next. Wait for my go-ahead before the
   next item. Do not deploy.

### Step 4 — Final summary

When the plan is complete (or I stop you), give me a single plain-language summary:
- what was **applied** (in order),
- what was **skipped** and why (optional capabilities I declined),
- what's **deferred** or blocked,
- the **migrations** generated but not yet run,
- the ordered **next steps for a technical person** (review branch → review & run
  migrations → set any SSM values → deploy staging-first → production),
- and confirm **`.retrofit-state.json` reflects the final state** of every item.

## PROMPT END
