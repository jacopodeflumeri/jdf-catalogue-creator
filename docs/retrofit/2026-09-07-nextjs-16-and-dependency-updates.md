# Retrofit prompt — Next.js 16 + dependency refresh

> Implements the **2026-09-07 "Next.js 16 + dependency refresh (13 advisories → 4)"**
> entry in [`MIGRATION.md`](../../MIGRATION.md).
>
> **Applies to every fork.** Carries one **major** (Next.js 15.5 → 16.3) plus a
> security/currency dependency pass. **Three things break if you bump the version and
> stop there:** `next build --no-lint` no longer exists (this breaks the **Docker build
> and every deploy**), the `middleware` file convention is renamed to `proxy`, and one
> `next.config.ts` key rename **fails silently**. No schema changes, no SSM, no infra
> changes beyond a routine CDK library bump.
>
> The agent owns the branch, edits the manifests, re-resolves lockfiles, does the Next 16
> migration, and runs typecheck + lint + tests + a real production build. **A human runs
> the deploy** and decides on the still-deferred `next-auth` → Auth.js v5 migration.

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

You are applying the **Next.js 16 + dependency refresh** pass to the **current project**
(an existing Mapp Labs app). This is a dependency-currency pass that carries one framework
**major**. There is **no database, SSM, or infra change** beyond a routine CDK library
bump, but there *are* real breaking changes, and one of them breaks deploys.

The authoritative reference is a fresh checkout of `labs-app-template` at:

    <TEMPLATE_PATH>

If that path is the literal placeholder, empty, or not a `labs-app-template` checkout (no
`package.json` with these deps, no `src/proxy.ts` or `src/middleware.ts`), **stop and ask
me for the correct path.** Also remind me to have pulled the **latest** template, and tell
me its version.

### Who I am

Assume I may **not** be a developer. **You** own the git branch and run `npm install`,
`npm audit`, typecheck, lint, tests, and a local production build. The only things you
must **not** do yourself: any real deploy, and the `next-auth` → Auth.js v5 migration
(out of scope — flag it). Explain everything in plain language.

### Operating principles (read before touching anything)

1. **The template is the reference target, not a literal source to copy.** Match its
   versions and conventions; adapt to this app's `package.json` and its own routes.
2. **Above all, do not break this app.** Green typecheck + lint + tests **+ a successful
   production build** is the bar before handback. Safest change over a risky one.
3. **Keep libraries current — toward this template, not the bleeding edge.** Take the
   in-range bumps and the one sanctioned major (Next 16). Do **not** opportunistically
   jump *other* majors (`eslint` 10, `typescript` 7, `openai` 7, `@types/node` 26,
   `@testing-library/jest-dom` 7, `@asteasolutions/zod-to-openapi` 9,
   `eslint-plugin-security` 4, Auth.js v5) — those are separate, out-of-scope decisions.
4. **Nothing published in the last 7 days.** See Step 1 — this is a hard rule, not a
   preference, and caret ranges will defeat it unless you use the mechanism given.
5. **Surface every deviation** (a dep this app pins differently, a `next.config.ts` this
   app has customised, a middleware file that isn't where the template's is) and why.
6. **My versions may differ.** This app may be several template versions behind or ahead
   on individual deps, and **may already be on Next 16** — read what's actually here and
   reconcile. Don't assume the "from" versions below.
7. **When something is genuinely complex/risky/ambiguous and I can't answer, tell me to
   get help — don't guess.** Point me to **#topic-mapp-labs** / **#topic-ai-support**.

### Step 0 — Branch and assess

1. Create a git branch (e.g. `retrofit/nextjs-16-dependency-updates-2026-09-07`). All work
   happens there. **Do not work on `main`.**
2. In the **template**, read `package.json` and `infra/package.json` for target versions,
   and read the **2026-09-07** entry in `MIGRATION.md`.
3. In **this** app, record the starting state: `npm audit`, `npm outdated`, the resolved
   `next` version (`npm ls next`), and whether `src/middleware.ts` or `src/proxy.ts`
   exists.

**Read this app's current `next` version carefully — it decides how urgent this is:**

| This app is on | What that means |
|---|---|
| **15.5.21 or later** | Not exposed to the recent Next CVE batch. This is a currency pass. |
| **15.x below 15.5.21** | **Exposed.** SSRF in Server Actions, SSRF via rewrites, cache confusion, DoS. Urgent. |
| **16.0 – 16.2.10** | **Exposed.** 16.x was not patched until **16.2.11** — a newer-looking major is *not* automatically safer. Urgent. |
| **16.2.11 or later** | Not exposed; you only need the dependency half of this prompt. |

Tell me which row this app is in before you start changing things.

### Step 1 — The 7-day rule (how to resolve, not just what to pin)

**Do not install any package version published within the last 7 days.** A brand-new
release is where supply-chain compromises and regressions surface, and this template is
copied into many apps before anyone would notice.

Hand-pinning does not achieve this, because caret ranges float on install. Use npm's date
cutoff for **every** install in this retrofit, in both the app root and `infra/`:

```bash
npm install --before=$(date -u -v-7d +%Y-%m-%d)     # macOS
npm install --before=$(date -u -d '7 days ago' +%Y-%m-%d)   # GNU/Linux
```

If a version you need is newer than the cutoff, **stop and tell me** rather than reaching
past it. (For scale: on the template, a plain `npm install` grabbed `next@15.5.25` and
`postcss@8.5.28`, both days old, on a manifest that was supposed to hold at 15.5.24.)

### Step 2 — Next.js 16 migration (the part that breaks things)

Do this **before** worrying about the rest of the dependency list, because it's where the
risk is. Bump `next` to the template's `^16.3.x` and `eslint-config-next` to match.

**2a. `next build --no-lint` is removed — find and fix every use.** This is the change
most likely to break this app, because it breaks the **Docker build and therefore every
deploy** with `error: unknown option '--no-lint'`.

```bash
grep -rn -- "--no-lint" . --exclude-dir=node_modules --exclude-dir=.next
```

Check the `Dockerfile` (the template's was `RUN npx next build --no-lint` at line ~72),
plus `Makefile`, `scripts/`, `package.json` scripts, and any CI workflow. Drop the flag.

**2b. `middleware` → `proxy` file convention.** Next 16 renamed it. Prefer the official
codemod, then verify:

```bash
npx @next/codemod@canary middleware-to-proxy .
```

If the codemod doesn't apply cleanly, do it by hand: `git mv src/middleware.ts
src/proxy.ts` and rename the inner function if it's named `middleware`. **The `export
default` and `export const config` shapes do not change** — if the codemod rewrites the
matcher or the auth wrapper, that's wrong; revert and do it by hand.

**Reassurance, so you don't panic if you find one:** Next 16 **still honours** a leftover
`src/middleware.ts`, emitting a deprecation warning. A fork that skipped this is **not**
silently unprotected. Do the rename anyway.

**2c. `experimental.middlewareClientMaxBodySize` → `proxyClientMaxBodySize`.** In
`next.config.ts`. **Unlike the file rename, this one fails silently** — the old key is
ignored, quietly restoring the default body limit on an app that deliberately raised it
(the template raises it to `100mb` for uploads). If this app doesn't set the key at all,
skip this and say so.

**2d. Expect `tsconfig.json` to be rewritten by the first build.** Next 16 flips
`"jsx": "preserve"` → `"react-jsx"`, adds `.next/dev/types/**/*.ts` to `include`, and
reformats the file. This is normal. Run the build, then **commit the result deliberately**
— don't fight it, and don't let me discover it later as a mystery dirty file. Confirm
`npm run type-check` and `npm test` still pass afterwards (on the template they did).

**2e. `next build` no longer runs ESLint.** Next 16 removed the build-time integration.
Nothing fails, which is the trap: the Docker build used to catch unused variables and no
longer does. Two things to do:

- Make sure lint runs somewhere explicit — `npm run check-all` / `make dev-check-all`,
  and ideally CI. Tell me plainly that the build is no longer a backstop.
- If this app's `docs/DEPLOYMENT.md` (`docs/template/DEPLOYMENT.md` in apps on the 2026-10-17 docs layout) claims lint errors break the Docker build (the
  template's did), correct it.

**2f. Update stale references to the renamed file.** Grep for `src/middleware.ts` in
comments and docs and update the live ones:

```bash
grep -rn "src/middleware.ts" . --exclude-dir=node_modules --exclude-dir=.next
```

Leave **historical records alone** — `MIGRATION.md` entries and older
`docs/retrofit/*.md` describe what was true then and should not be rewritten. Do **not**
rename `src/lib/middleware/` (an unrelated API-route security wrapper) — only the Next
file convention moved.

**2g. If this app is already on Next 16**, skip 2b–2d if they're already done, but still
do **2a** (the `--no-lint` flag), **2e**, and confirm the resolved version is **≥16.2.11**
— below that it is missing the security batch.

### Step 3 — Dependency bumps

Reconcile toward the template, adapting if this app is on a different line (don't force a
*lower* version onto an app that's already ahead).

**Security-relevant:**

- **`dompurify`** → the template's `^3.4.x` (MODERATE XSS — `IN_PLACE` hook removal
  leaves a detached subtree executable). The only advisory here reachable from app code.
- **The Prisma trio — `@prisma/client`, `@prisma/adapter-pg`, and the pinned `prisma`
  CLI — move together** to the template's version. The CLI is pinned **exact** (no caret)
  in `dependencies`; bump it explicitly or the three drift. **Check for existing drift
  before you start** (`npm ls prisma @prisma/client`): on the template the CLI sat at an
  exact `7.8.0` while the other two had floated to `7.9.1`. `postinstall` regenerates the
  client on install.

**Routine currency:** match the template for `@aws-sdk/*`, `@notionhq/client`, `axios`,
`jose`, `pg`, `sharp`, `swagger-ui-dist`, `zod`, `jest` (+`@jest/globals`,
`jest-environment-jsdom`), `@testing-library/*`, `postcss`, `tsx`. Only bump packages this
app actually has. (`axios` and `swagger-ui-dist` were later removed from the template; if
this app still uses them, keep them current with `npm outdated` instead.)

**Remove `@types/dompurify`** if present — a deprecated stub; `dompurify` has shipped its
own types since 3.0 and the stub only conflicts. Confirm `npm run type-check` still passes.

**Do not bump `echarts-for-react` to 3.0.7** if you see it offered — npm's `latest`
dist-tag still points at 3.0.6; 3.0.7 was published out of band and never tagged.

### Step 4 — Infra CDK bump (ONLY if this app has an `infra/` CDK project)

Skip if there's no `infra/` with `aws-cdk-lib` — tell me it doesn't apply.

This is a **library-only** bump — **you do NOT re-bootstrap** (and you can't:
`cdk bootstrap` needs `iam:CreateRole`/`iam:PassRole`, which the standard
`labs-power`/PowerUserAccess deployer lacks).

1. Bump `aws-cdk-lib` and the `aws-cdk` CLI to the template's versions. **They are on
   different version numbers** (the CLI decoupled after ~2.177) — match the template,
   don't force them equal. Keep `constructs` at `^10`. Install with the same `--before`
   cutoff, then `npm run build` (`tsc`).
2. **The go/no-go (read-only).** `npx cdk synth -c env=<env>` for each env, then compare
   the required bootstrap version against the live one:
   ```bash
   grep -rho '"requiresBootstrapStackVersion"[: ]*[0-9]*' cdk.out | sort -u
   aws ssm get-parameter --name /cdk-bootstrap/hnb659fds/version --query Parameter.Value --output text
   ```
   **Required ≤ live → proceed.** **Required > live → STOP and tell me** (that needs an
   admin re-bootstrap, out of scope here; leave the pin).
3. **Do NOT touch `cdk.json` feature flags.** A "N feature flags not configured" synth
   note is expected and fine.
4. **Human deploy steps (you prepare; you do NOT deploy).** Give me an ordered checklist:
   `cdk diff -c env=staging` against the real deployed stack → expect **benign** changes
   only (CDK-managed custom-resource Lambda runtime bumps, minor IAM-policy minimization)
   → **no resource replacements** → `make staging-deploy` → verify health → repeat for
   production. **If `cdk diff` shows a replacement, stop and tell me.**

### Step 5 — Tests

The template added **`src/__tests__/proxy.test.ts`**, which pins the whole Next 16
migration so a half-applied upgrade fails in `npm test` rather than in a deploy. Port it,
adapting the matcher assertions to **this app's actual protected routes** — do not just
copy the template's route list.

It should assert:

- the route-protection matcher covers this app's protected trees, and that any route
  deliberately excluded from the matcher (the template excludes `/api/images`, which
  authorizes itself) stays excluded;
- no matcher entry is a catch-all (`/:path*` in front of everything locks users out of
  the sign-in page that would fix it);
- `src/proxy.ts` exists and `src/middleware.ts` does **not**;
- `next.config.ts` uses `proxyClientMaxBodySize` and not the old key — **match the
  object-key form** (e.g. `/^\s*proxyClientMaxBodySize\s*:/m`), not a bare substring, or a
  comment mentioning the old name will fail the test;
- the `Dockerfile` contains no `--no-lint`.

If reading repo files trips `security/detect-non-literal-fs-filename`, follow this app's
existing convention for that rule (a targeted `eslint-disable-next-line` **with a comment
explaining why it's safe**) rather than weakening the rule globally.

Also fix any **existing** test that referenced the old middleware path.

### Step 6 — Verify

Run all of these and report real numbers:

- `npm run type-check` — must be clean.
- `npm run lint` — must be **0 errors**. Expect *new warnings*: `eslint-config-next`
  16.3.x adds `@next/next/no-location-assign-relative-destination`, which fires on
  `window.location.href` used for internal navigation (8 warnings across 7 files on the
  template). **Report them; do not fix them in this pass** — that's a code change, not a
  dependency change. Flag it as a follow-up.
- `npm test` — all green.
- **A real production build** (`npx next build`, with whatever dummy build-time env this
  app needs). This is not optional: it's what proves the Next 16 migration actually works,
  and it's the step that catches the `--no-lint` breakage. Confirm the output reports
  `ƒ Proxy (Middleware)`.
- `npm audit` before and after, in **both** the app root and `infra/`.

**Expect HIGH advisories to remain, and do not chase them.** On the template, 4 HIGH
remain, all inside the Prisma CLI's own exact-pinned tree (`mysql2`, `deepmerge-ts`,
`@prisma/config`, `prisma`). They are devtool-tier — `mysql2` is a MySQL driver a Postgres
app never loads — and **Prisma fixes them upstream**.

- **Do NOT run `npm audit fix --force`.** Here it proposes `prisma@6.19.3`, a
  **downgrade**, and would also downgrade `next-auth`.
- **Do NOT add `overrides` to silence them.** Reaching into another package's pinned tree
  (this would include a `deepmerge-ts` 7→8 **major** inside Prisma's config loader) trades
  a known devtool advisory for an unknown breakage. A real fork has an override added for
  an old `fast-xml-parser` advisory that now pins that package *into* a newer vulnerable
  range — a stale override is worse than the advisory it closed.
- If this app already has `overrides`, **audit them**: report any that are now redundant
  or actively pinning to a vulnerable version. Don't remove them silently.

**Do not deploy.**

### Deferred — do NOT do these here (flag them)

- **`next-auth` → Auth.js v5.** v4 is terminal, but the fix is a **breaking migration**
  (`getServerSession()` → `auth()`, config reshape, `NEXTAUTH_SECRET` → `AUTH_SECRET`),
  not a bump. Flag it and stop. If you see `@auth/core` or `@auth/prisma-adapter` in this
  app's tree, note that they carry their own **CRITICAL** advisories and tell me — that
  raises the priority of the v5 decision, but it is still not this prompt's job.
- Other majors: `eslint` 10, `typescript` 7, `openai` 7, `@types/node` 26,
  `@testing-library/jest-dom` 7, `@asteasolutions/zod-to-openapi` 9,
  `eslint-plugin-security` 4.
- The 8 new `no-location-assign-relative-destination` warnings.

### Record state

Before handback, write/update **`.retrofit-state.json` at this app's repo root** (create
if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`. Upsert this
retrofit under `retrofits["2026-09-07-nextjs-16-and-dependency-updates"]` with `status`
(applied / partial / skipped / not-applicable), `templateVersion` + `templateRef`, an
ISO-8601 UTC `at` (`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, and `notes` + any `deviations`.

Good things to record: the Next version this app started on and which risk row it was in;
whether `--no-lint` was present (and where); whether the app was already on Next 16;
whether `middlewareClientMaxBodySize` was set; audit before/after counts for app and
`infra`; any pre-existing `overrides` you flagged; "CDK section N/A — no infra/". Refresh
`template.lastRetrofitAgainstVersion` / `lastRetrofitAgainstRef` / `lastRetrofitAt`; don't
remove other entries.

### Plain-language handback

1. **Which risk row this app was in** on Next before you started, and whether it was
   actually exposed to the recent Next CVEs.
2. Which deps you bumped, from → to, and the before/after `npm audit` counts for both the
   app and `infra`.
3. **The `--no-lint` finding** — whether this app had it, and that leaving it would have
   broken every deploy.
4. That **`next build` no longer runs ESLint**, so `make dev-check-all` is now the only
   thing enforcing it before a deploy.
5. That `tsconfig.json` was rewritten by the build on purpose, and you committed it.
6. The remaining HIGH advisories, why they were left, and that `npm audit fix --force`
   must not be run.
7. That `next-auth` → Auth.js v5 remains a **separate tracked decision**.
8. The ordered **human** deploy checklist (staging `cdk diff` → deploy → verify → prod).
9. Every **deviation** from the template and why.
10. If anything got complicated and I didn't have an answer, remind me I can ask in
    **#topic-mapp-labs** / **#topic-ai-support**.

## PROMPT END
