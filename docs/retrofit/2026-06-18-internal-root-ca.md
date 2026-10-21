# Retrofit prompt — Trust the Mapp internal root CA

> Implements the **2026-06-18 "Trust the Mapp internal root CA at the image layer"**
> entry in [`MIGRATION.md`](../../MIGRATION.md).
>
> **Mandatory / applies to every fork.** From here on every Labs app authenticates via
> **Keycloak** and calls **internal Mapp HTTPS services** (company-management-service,
> product-feed-service, internal Keycloak) — there is no auth without trusting their
> root CA. This is an **image-layer change only: Dockerfile + container entrypoint +
> one vendored cert. No database migration, no SSM parameters, no CDK/infra change.**

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

You are making the **current project** (an existing Mapp Labs app) trust the **Mapp
internal root CA** (`ca.internal.mapp.tools`) at the container-image layer, so it can
call internal Mapp HTTPS services and Keycloak without TLS errors. This is **pure
image/runtime config** — there is **no database migration, no SSM parameter, and no
CDK/infra change** in this work.

The authoritative reference implementation is a fresh checkout of `labs-app-template`
at:

    <TEMPLATE_PATH>

If that path is still the literal placeholder, is empty, or doesn't look like a
`labs-app-template` checkout (no `certs/ca.internal.mapp.tools.crt`, no `Dockerfile`),
**stop and ask me for the correct path before doing anything else.** Also remind me I
should have pulled the **latest** template into that directory, and tell me its version.

### Who I am

Assume I may **not** be a developer. **You** own the git branch. Explain what you
changed in plain language. Do not assume I can fill gaps myself.

### Operating principles (read these before touching anything)

1. **The template is the reference design, not a literal source to copy.** Match the
   template's model and conventions, but adapt to how *this* app's Docker build is
   actually structured. **If this app has no equivalent paradigm, lean toward the
   template's reference architecture.**
2. **Above all, do not break this app.** A working app beats a broken one. If a clean
   change isn't possible, do the safest partial version and tell me what you skipped.
3. **Copy verbatim only where it's clearly safe.** Where this app already has its own
   version (Dockerfile, entrypoint), port the *pattern* in, don't overwrite wholesale.
4. **Surface every deviation** from the template and why.
5. **My libraries / base images may differ from the template's.** Adapt to what's here.
6. **Reuse shared infrastructure — never duplicate it per app.** The internal root CA
   is a **shared, non-secret** root used by every Labs app. Use the **same** vendored
   cert — do **not** mint a per-app or per-service CA, and do **not** create any
   `*_CA_PEM` SSM parameter for internal services (their root is trusted in the image).
7. **Keep libraries and patterns reasonably current — toward this template, not the
   bleeding edge.** Prefer the template's versions/patterns; do **not** bump a
   dependency to the newest *public* release just because it exists (supply-chain
   risk + unvalidated here). The template's pinned version is the target. Flag risky
   version changes instead of silently making them.
8. **When something is genuinely complex, risky, or ambiguous and I can't answer,
   tell me to get help — don't guess.** Stop and ask me; if I don't know either,
   point me to the Labs Slack channels **#topic-mapp-labs** or **#topic-ai-support**.

### Step 0 — Branch and assess

1. Create a git branch (e.g. `retrofit/internal-root-ca`). All work goes here.
2. Read, in the template: `<TEMPLATE_PATH>/docs/template/INTERNAL-CA.md`, the vendored cert
   `certs/ca.internal.mapp.tools.crt`, the CA-related lines of the **runner stage** of
   `<TEMPLATE_PATH>/Dockerfile`, and the CA-bundle block of
   `<TEMPLATE_PATH>/scripts/docker-entrypoint.sh`. Also read the **2026-06-18**
   internal-CA entry in `MIGRATION.md`.
3. In **this** app, find: the `Dockerfile` (identify its **final/runner stage** and
   its **base image** — Debian/Ubuntu vs Alpine), and the **container entrypoint**
   (e.g. `scripts/docker-entrypoint.sh`, or however this app starts the server).
4. **Confirm the deploy model.** This retrofit targets the **Docker/CDK** deploy path
   (the Makefile + `infra/` CDK). If this app appears to deploy **only via PM2** (no
   Dockerfile, an `ecosystem.config.cjs`/`deploy.sh` host deploy), **stop and tell
   me** — PM2 is legacy; the right move is to be on the Docker/CDK path first. Don't
   improvise a host-level CA install without asking (see principle 8 / Slack).

### The three parts

**1. Vendor the cert.**
Copy `certs/ca.internal.mapp.tools.crt` from the template into this app at the same
path. It **must** keep the `.crt` extension — the repo `.gitignore` ignores `*.pem`,
so a `.pem` copy would silently never be committed.
- Verify this app's `.gitignore` won't ignore it (check for `*.crt`, `certs/`, etc.);
  if it would, fix the ignore rule so the cert commits.
- Verify the cert is a self-signed root before trusting it:
  `openssl x509 -in certs/ca.internal.mapp.tools.crt -noout -subject -issuer`
  — subject and issuer must be **identical** (`CN=ca.internal.mapp.tools`).
- The canonical source for rotation is `mapp-digital/devops-kube-ansible`
  (`roles/ca_certs/files/ca.internal.mapp.tools.crt`); note that for the future.

**2. System trust store (Dockerfile, runner/final stage).**
In this app's final image stage: install `ca-certificates` and `openssl`, copy the
cert into `/usr/local/share/ca-certificates/`, and run `update-ca-certificates`.
- **Base-image gotcha:** the template is Debian/Ubuntu-based and uses
  `apt-get install -y --no-install-recommends ca-certificates openssl`. If this app's
  final stage is **Alpine**, use `apk add --no-cache ca-certificates openssl` instead
  (and the same copy + `update-ca-certificates`). Match this app's existing package
  manager; don't switch base images.

**3. Node trust (container entrypoint).**
Node's `https` does **not** read the OS trust store, so the entrypoint must build a
single `NODE_EXTRA_CA_CERTS` bundle that **always** includes the vendored root and
**additively** appends `KEYCLOAK_CA_PEM` when it's set (treat a lone-space placeholder
as empty). `NODE_EXTRA_CA_CERTS` **adds to** the Mozilla roots — it does not replace
them — so public-CA chains keep working. Port the template's
`scripts/docker-entrypoint.sh` CA-bundle block into this app's entrypoint, adapting to
its structure. **Never overwrite the vendored root with the runtime PEM — append.**

### Guardrails (do NOT do these)

- Do **not** create a `*_CA_PEM` SSM parameter for internal services
  (company-management-service, product-feed-service, internal Keycloak under the root).
- Do **not** set `rejectUnauthorized: false` / any `*_TLS_INSECURE` for internal
  services. `KEYCLOAK_TLS_INSECURE` is only an emergency transitional bypass, never the
  answer for a cert that already chains to `ca.internal.mapp.tools`.
- `KEYCLOAK_CA_PEM` is for **one** edge case only: a Keycloak host whose cert is **not**
  under the internal root (third-party IdP, or a public chain missing intermediates).

### Verify and hand back

- Confirm the cert is staged/committed (not ignored) and passes the self-signed check.
- If you can build the image locally, build it and confirm `update-ca-certificates`
  reports adding 1 cert and the entrypoint logs `Loaded internal CA(s) into
  NODE_EXTRA_CA_CERTS`. Full verification (an actual TLS call to an internal service)
  requires a deploy — note that; **do not deploy**.
- There is **no migration, no SSM, and no CDK change** to run for this entry.

### Record state

Before the handback, write/update **`.retrofit-state.json` at this app's repo root**
(create it if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert this retrofit under `retrofits["2026-06-18-internal-root-ca"]` with `status`
(applied / partial / skipped / not-applicable), `templateVersion` + `templateRef` (the
template version and exact git tag/SHA you worked against), an ISO-8601 UTC `at`
(`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, `notes` + any `deviations`, and the `capability`
id if this retrofit maps to one. Refresh `template.lastRetrofitAgainstVersion` /
`lastRetrofitAgainstRef` / `lastRetrofitAt`; don't remove other entries.

Then give me a **plain-language handback**:
1. What you changed (cert vendored, Dockerfile stage, entrypoint).
2. The app's **base image** (Debian/Ubuntu vs Alpine) and which package manager you
   used.
3. Any **deviations** from the template and why (e.g. different entrypoint shape).
4. Confirmation that no SSM/CDK change was needed and none was made.
5. What a technical person should review before this ships (build + deploy to staging,
   then confirm an internal-service call succeeds without TLS errors).
6. If anything got complicated and I didn't have an answer, remind me I can ask in
   **#topic-mapp-labs** or **#topic-ai-support**.

## PROMPT END
