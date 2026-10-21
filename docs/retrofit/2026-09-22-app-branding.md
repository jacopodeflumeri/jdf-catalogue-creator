# Retrofit prompt — App identity in navigation and login

> Implements the **2026-09-22 "App identity in navigation and login"** entry in
> [`MIGRATION.md`](../../MIGRATION.md).
>
> **Optional and cosmetic.** Makes the app show its own display name (and optionally a
> logo) in the sidebar, mobile header, top navigation, login page and browser tab,
> instead of the AWS resource slug or a hardcoded "Mapp Labs". **UI code + one config
> field. No database migration, no SSM, no infra.**

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

You are making the **current project** (an existing Mapp Labs app) identify itself by
its **display name**, and optionally a logo, across its shared navigation and login
page. This is **UI and config only** — there is **no database migration, no SSM
parameter, and no CDK/infra change** in this work.

The authoritative reference implementation is a fresh checkout of `labs-app-template`
at:

    <TEMPLATE_PATH>

If that path is still the literal placeholder, is empty, or doesn't look like a
`labs-app-template` checkout (no `src/config/branding.ts`, no `docs/template/APP-BRANDING.md`),
**stop and ask me for the correct path before doing anything else.** Also remind me I
should have pulled the **latest** template into that directory, and tell me its version.

### Who I am

Assume I may **not** be a developer. **You** own the git branch. Explain what you
changed in plain language. Do not assume I can fill gaps myself.

### Operating principles (read these before touching anything)

1. **The template is the reference design, not a literal source to copy.** The layout
   files involved are among the ones apps customise most. Match the template's pattern
   inside the layout this app actually has.
2. **Above all, do not break this app, and do not undo its design.** If this app
   already shows its own name or logo somewhere in a way its owner clearly chose, keep
   it and tell me — don't replace deliberate branding with the template's default.
3. **Copy verbatim only where it's clearly safe** (the three new files). Everywhere
   else, make the smallest edit that swaps the name markup for the shared component.
4. **Surface every deviation** from the template and why.
5. **Follow the design system.** Read `<TEMPLATE_PATH>/docs/template/DESIGN-SYSTEM.md` ("App
   identity") first. Use existing components, tokens and spacing; introduce no new
   colours or ad-hoc values.
6. **When something is ambiguous and I can't answer, tell me to get help — don't
   guess.** Point me to **#topic-mapp-labs** or **#topic-ai-support**.

### Step 0 — Branch and assess

1. Create a git branch (e.g. `retrofit/app-branding`). All work goes here.
2. Read, in the template: `docs/template/APP-BRANDING.md`, the "App identity" section of
   `docs/template/DESIGN-SYSTEM.md`, `src/config/branding.ts`,
   `src/components/shared/layout/AppBranding.tsx` and `MobileAppHeader.tsx`, and the
   **2026-09-22** entry in `MIGRATION.md`.
3. In **this** app, find every place the app's name is shown:

   ```bash
   grep -rnE "config\.app\.name|\"Mapp Labs\"|'Mapp Labs'|appName" src --include="*.tsx" --include="*.ts"
   ```

   and locate its equivalents of: the root layout, the sidebar, the top navigation, the
   company-customer header (if it has Company Login), the admin sign-in page, and the
   admin and customer layout shells.
4. Read `app.config.json`. Tell me the current `appName` (the slug) and `displayName`,
   and **ask me to confirm the display name** people should see before you go on.

### Step 1 — Config

1. Add `"logoPath": ""` to `app.config.json`, next to `displayName`. Merge it in; do
   not rewrite the file.
2. If `displayName` is missing or still the template default, set it to the name I
   confirmed.
3. Add the commented `APP_DISPLAY_NAME` line from the template's `.env.example` to this
   app's `.env.example`.
4. **Do not change `appName` or `APP_NAME`.** They are the AWS resource and billing
   slug; changing them renames infrastructure. The visible name comes from
   `displayName`.
5. If this app has a `scripts/setup.sh` that writes `app.config.json`, add `logoPath`
   there as the template does. If it doesn't, skip this.

### Step 2 — New files

Copy from the template:

- `src/config/branding.ts`
- `src/components/shared/layout/AppBranding.tsx`
- `src/components/shared/layout/MobileAppHeader.tsx`

`branding.ts` is `server-only` and imports `app.config.json` by relative path — check
the import resolves from where you put it. `MobileAppHeader` uses the app's `Button`
and `Icon`; confirm the `menu` icon exists in this app's `Icon` component and use the
app's existing menu icon if the name differs.

### Step 3 — Wire it in

Port the pattern from the template's version of each file:

1. **Root layout** — wrap the tree in `<AppBrandingProvider branding={getAppBranding()}>`
   (outermost, around the existing providers) and use `getAppBranding().name` in the
   page metadata.
2. **Sidebar** — `<AppIdentity />` under the Mapp logo in the expanded and mobile
   variants, `<AppIdentity compact />` in the collapsed variant. **Keep the Mapp logo
   and the environment indicator**; the app name goes below them.
3. **Top navigation** — replace the app-name pill with `<AppIdentity />`.
4. **Company-customer header** — replace the name text with `<AppIdentity />`.
5. **Admin sign-in page** — pass `getAppBranding().name` instead of the hardcoded
   name; use `<AppIdentity compact />` for the mark above the heading.
6. **Admin and customer layout shells** — add `<MobileAppHeader />`, wired to whatever
   opens this app's mobile navigation drawer.
7. **Per-page titles** — make `pageTitle()` in `src/lib/utils/metadata.ts` use
   `getAppBranding().name`. That makes the helper **server-only**: confirm every caller
   is a server component (normally a page's `metadata` export). If one is a client
   component, use `useAppBranding()` there instead.
8. **Signing-out screen** — use `useAppBranding().name` in the "signing you out of …"
   line.
9. **Anything else from your Step 0 grep** that renders `config.app.name` to a user —
   on ECS that value is the slug. Switch each to the resolved name. Leave non-display
   uses alone (e.g. code that derives a slug or group name from it).

Only the resolved name and logo path may cross to the browser. Do **not** read
`process.env` or import `branding.ts` from a client component — use `useAppBranding()`.

### Step 4 — Optional logo

Ask me whether I have a logo. If I do: put a **square SVG, PNG or WebP** under
`public/img/` and set `logoPath` to its root-relative path (e.g. `/img/my-app.svg`).
Remote URLs are not supported and are ignored by design. If I don't, leave `logoPath`
empty — the app shows its name, and its initials where space is tight.

### Verify and hand back

- Type-check, lint and tests pass. If this app has a layout test (the template has
  `AdminLayoutClient.test.tsx`), make sure it still passes with the new header.
- If I can run the app locally, start it and check: expanded sidebar, collapsed
  sidebar, a narrow (mobile-width) window, the login page, and the browser tab title.
- Nothing here needs a migration or an infra change. It ships with the next ordinary
  `make <env>-deploy`; **do not deploy**.

### Record state

Before the handback, write/update **`.retrofit-state.json` at this app's repo root**
(create it if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert this retrofit under `retrofits["2026-09-22-app-branding"]` with `status`
(applied / partial / skipped / not-applicable), `templateVersion` + `templateRef` (the
template version and exact git tag/SHA you worked against), an ISO-8601 UTC `at`
(`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, and `notes` + any `deviations`. Refresh
`template.lastRetrofitAgainstVersion` / `lastRetrofitAgainstRef` / `lastRetrofitAt`;
don't remove other entries.

Then give me a **plain-language handback**:

1. The display name the app now shows, and whether a logo is set.
2. Each place you changed, and what it looked like before.
3. Anything you **left alone** because this app already had its own branding there.
4. Any **deviations** from the template and why.
5. Confirmation that no migration, SSM or infra change was needed and none was made.
6. If anything got complicated and I didn't have an answer, remind me I can ask in
   **#topic-mapp-labs** or **#topic-ai-support**.

## PROMPT END
