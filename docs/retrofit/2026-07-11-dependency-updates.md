# Retrofit prompt — Dependency updates (security + Notion SDK v5)

> Implements the **2026-07-11 "Dependency updates (security + Notion SDK v5)"**
> entry in [`MIGRATION.md`](../../MIGRATION.md).
>
> **Soft-mandatory for the security bumps** (a **HIGH**-severity `ws` advisory + a
> Next.js patch + axios + Prisma); **the Notion SDK v5 major only applies if this
> app has the User Feedback capability.** Pure dependency refresh — the only source
> edits are whatever the Notion major forces, and for the template that was *none*
> (the payload already used the modern shape). No schema / SSM / infra change.
>
> The agent owns the branch, edits `package.json`, re-resolves the lockfile, and
> runs typecheck + tests. **A human decides whether to also do the deferred
> `next-auth` → Auth.js v5 migration** (out of scope here) and runs one real
> staging feedback submission if the Notion bump is taken.

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

You are applying a **dependency-update** pass to the **current project** (an existing
Mapp Labs app): a set of security/patch bumps that apply to every fork, plus one
**major** SDK jump (`@notionhq/client` v2 → v5) that only matters if this app has the
**User Feedback** capability. This is a dependency refresh — **no database, SSM, or
infra change**, and for the reference template it required **zero source edits** (the
Notion payload already used the modern shape).

The authoritative reference is a fresh checkout of `labs-app-template` at:

    <TEMPLATE_PATH>

If that path is the literal placeholder, empty, or not a `labs-app-template` checkout
(no `package.json` with these deps, no `src/modules/user_feedback/`), **stop and ask me
for the correct path.** Also remind me to have pulled the **latest** template, and tell
me its version.

### Who I am

Assume I may **not** be a developer. **You** own the git branch and run `npm install`,
`npm audit`, typecheck, and tests. The only things you must **not** do yourself: the
`next-auth` → Auth.js v5 migration (out of scope — flag it), and any real deploy.
Explain everything in plain language.

### Operating principles (read before touching anything)

1. **The template is the reference target, not a literal source to copy.** Match its
   versions and conventions; adapt to this app's `package.json`.
2. **Above all, do not break this app.** A green typecheck + test run is the bar before
   handback. Safest change over a risky one.
3. **Keep libraries current — toward this template, not the bleeding edge.** Take the
   in-range/patch bumps and the one sanctioned major (Notion). Do **not** opportunistically
   jump *other* majors (`typescript` 7, `eslint` 10, `sharp` 0.35, `next` 16, Auth.js v5)
   — those are separate, out-of-scope decisions.
4. **Surface every deviation** (a dep this app pins differently, a Notion payload that
   doesn't match the template's shape, a test that isn't mocked the same way) and why.
5. **My versions may differ** — this app may be several template versions behind or ahead
   on individual deps. Read what's actually in this app's `package.json` and reconcile;
   don't assume the "from" versions below.
6. **When something is genuinely complex/risky/ambiguous and I can't answer, tell me to
   get help — don't guess.** Point me to **#topic-mapp-labs** / **#topic-ai-support**.

### Step 0 — Branch and assess

1. Create a git branch (e.g. `retrofit/dependency-updates-2026-07-11`). All work here.
2. In the **template**, read `package.json` for the target versions of: `next`,
   `@prisma/client`, `@prisma/adapter-pg`, the pinned `prisma` CLI, and (if present)
   `@notionhq/client`. (`axios` is no longer in the template — see Fix 1.) Read the **2026-07-11** entry in `MIGRATION.md`.
3. In **this** app, run `npm audit` and `npm outdated` and record the starting state.
   Note especially any **HIGH** advisories and where `ws` resolves
   (`npm ls ws`) — it's transitive (via `openai` and/or `jsdom`), so it's fixed by
   re-resolving the lockfile, not by a manifest edit.

### Fix 1 — Security / patch / minor bumps (all forks)

Reconcile this app's `package.json` toward the template for these (adapt if this app is
on a different line — e.g. don't force a lower version onto an app that's already ahead):

- **`next`** → the template's `15.5.x` patch (**stay on the 15.5 line; do NOT jump to
  16.x**). Next patches carry security fixes.
- **`axios`** (only if this app depends on it) → `1.18.x` or later (SSRF/redirect
  history). The template has since dropped `axios`; don't add it if this app lacks it.
- **Prisma trio — `@prisma/client`, `@prisma/adapter-pg`, and the pinned `prisma` CLI —
  move together to the template's version.** The CLI is pinned to an **exact** version
  (no caret) in `dependencies`; bump it explicitly or the three drift. `postinstall`
  regenerates the client on install.

Also, if this app has **`@types/sharp`** in `devDependencies` and `sharp` at **≥0.32**,
**remove `@types/sharp`** — it's a deprecated stub (`sharp` ships its own types since
0.32) that only conflicts with the bundled types. Confirm `npm run type-check` still
passes (it resolves `sharp`'s types from the package). If this app is on `sharp` <0.32,
leave `@types/sharp` in place.

Then, for the **HIGH**-severity transitive `ws`: run **`npm audit fix`** (non-breaking —
it only re-resolves `ws` past 8.20.1). Confirm with `npm ls ws` and a fresh `npm audit`
that HIGH is gone. **Do not** run `npm audit fix --force** — on this template it would
*downgrade* `next-auth` and `next`, which is wrong (see the deferred item below).

### Fix 2 — Notion SDK v2 → v5 (ONLY if this app has User Feedback)

Skip this entire section if `src/modules/user_feedback/` (or any `@notionhq/client`
import) is absent — tell me it doesn't apply.

If present:

1. Bump `@notionhq/client` to the template's `^5.x`. `npm install`.
2. **Let `tsc` do the work.** The template derives its property type from the SDK
   (`type NotionProperties = Parameters<NotionClient["pages"]["create"]>[0]["properties"]`
   or similar), so `npm run type-check` is the guard that this app's Notion payload still
   satisfies v5's types. If it type-checks, the v4 "legacy properties shape removed"
   breaking change does **not** affect this app.
3. If type-check **fails**, this app is likely still using the **legacy** pre-2021
   property shape (a flat `{ "Col": value }` map). Port each property to the modern
   polymorphic shape the template uses (`{ rich_text: [{ text: { content } }] }`,
   `{ number }`, `{ select: { name } }`, `{ email }`, `{ date: { start } }`,
   `{ title: [...] }`). Match the template's `notion.ts` exactly for the columns it has.
4. **The v5 API-version caveat — call this out explicitly to me.** v5 defaults to Notion
   API version `2025-09-03` (databases → data-source model). A `pages.create` with a
   `{ parent: { database_id } }` stays backward-compatible **only for a database with a
   single data source**. The tests **mock** the SDK, so **green tests do not prove a real
   write works under `2025-09-03`.** Tell me to do **one real feedback submission against
   staging** after this ships, and that if the shared "App Feedback" database is ever
   given multiple data sources the parent must become
   `{ type: "data_source_id", data_source_id }`.

### Fix 3 — Infra CDK bump (ONLY if this app has an `infra/` CDK project)

Skip if there's no `infra/` with `aws-cdk-lib` in its `package.json` — tell me it doesn't
apply.

If present, this is a **library-only** bump — **you do NOT re-bootstrap** (and you can't:
`cdk bootstrap` needs `iam:CreateRole`/`iam:PassRole`, which the standard
`labs-power`/PowerUserAccess deployer lacks). The whole point is to verify the existing
bootstrap already satisfies the newer CDK, so nothing shared changes.

1. In `infra/`, bump `aws-cdk-lib` and the `aws-cdk` CLI to the template's current
   versions. **They are on different version numbers now** (the CLI decoupled after
   ~2.177 — e.g. `aws-cdk-lib` `2.261.0`, `aws-cdk` `2.1130.0`); match the template, don't
   force them equal. Keep `constructs` at `^10`. `npm install`, then `npm run build`
   (`tsc`) — CDK v2 has an API-stability guarantee, so this should build unchanged; fix
   only what the bump genuinely broke.
2. **The go/no-go (read-only).** Run `npx cdk synth -c env=<env>` for each env and find
   `requiresBootstrapStackVersion` in `cdk.out` (`grep -rho '"requiresBootstrapStackVersion"[: ]*[0-9]*' cdk.out | sort -u`).
   Compare against the **live** bootstrap version:
   `aws ssm get-parameter --name /cdk-bootstrap/hnb659fds/version --query Parameter.Value --output text`.
   **If required ≤ live → proceed** (for this template: required 6/8, live 29). **If
   required > live → STOP and tell me** — that would need an admin-run re-bootstrap
   (labs-power can't), which is out of scope for this retrofit; flag it and leave the pin.
3. **Do NOT touch `cdk.json` feature flags.** Newer CDK adds flags; leaving the existing
   ones pinned is what keeps deployed resource behavior from shifting. (A "N feature flags
   not configured" synth note is expected and fine.)
4. **Human deploy steps (you prepare; you do NOT deploy).** Give me an ordered checklist:
   `cdk diff -c env=staging` against the **real** deployed stack (this only works in a
   deployed fork, not the template) → expect **benign** changes only (CDK-managed
   custom-resource Lambda **runtime** bumps like nodejs16/18→20+, maybe minor IAM-policy
   minimization deltas; **no resource replacements**) → `make staging-deploy` → verify
   health → repeat for production. **If `cdk diff` shows a replacement or anything
   surprising, stop and tell me.**

**Fleet-safe by construction:** each fork owns its own `infra/package.json` pin and
bootstrap is backward-compatible, so bumping this app changes nothing in other people's
already-deployed apps.

### Deferred — do NOT do these here (flag them)

- **`next-auth` 4.24.14 → Auth.js v5.** v4 is terminal and carries the moderate `uuid@8`
  advisory, but the fix is a **breaking migration** (`getServerSession()` → `auth()`,
  config export reshape, `NEXTAUTH_SECRET` → `AUTH_SECRET`), not a bump. If you see
  `next-auth@4` here, **flag it as tracked follow-up** and stop — do not attempt it and do
  **not** `audit fix --force` (that downgrades to v3).
- Other majors (`typescript` 7, `eslint` 10, `eslint-plugin-security` 4, `sharp` 0.35,
  `next` 16) — leave alone. (The CDK bump is **not** deferred — it's Fix 3 above; the
  `yaml` advisory clears with it.)

### Verify and hand back

- Run `npm run type-check` and `npm test` (the template has 349 tests). Fix anything your
  bumps broke; **do not** rewrite unrelated code. Run `npm audit` once more and record the
  before/after counts (HIGH should be 0).
- **Do not deploy.**

### Record state

Before handback, write/update **`.retrofit-state.json` at this app's repo root** (create
if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`. Upsert this
retrofit under `retrofits["2026-07-11-dependency-updates"]` with `status` (applied /
partial / skipped / not-applicable), `templateVersion` + `templateRef` (the version and
exact git tag/SHA you worked against), an ISO-8601 UTC `at` (`date -u +%Y-%m-%dT%H:%M:%SZ`),
`by`, and `notes` + any `deviations`. Good things to record in `notes`/`deviations`:
"Notion section N/A — no user_feedback capability", "app was on legacy Notion property
shape — ported to polymorphic", "next-auth v4 present — flagged Auth.js v5 as pending",
"audit HIGH 3 → 0". If this app had no HIGH advisories to begin with, say so. Refresh
`template.lastRetrofitAgainstVersion` / `lastRetrofitAgainstRef` / `lastRetrofitAt`; don't
remove other entries.

### Plain-language handback

1. Which deps you bumped, from → to, and that the HIGH `ws` advisory is cleared (with the
   before/after `npm audit` counts).
2. Whether the Notion section applied, and if so **the staging-submission reminder + the
   single-data-source caveat**.
3. That `next-auth` → Auth.js v5 remains a **separate tracked decision** (if `next-auth@4`
   is present here).
4. Every **deviation** from the template and why.
5. If anything got complicated and I didn't have an answer, remind me I can ask in
   **#topic-mapp-labs** / **#topic-ai-support**.

## PROMPT END
