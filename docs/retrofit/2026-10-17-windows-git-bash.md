# Retrofit prompt — Setup and deploy scripts work from Windows (Git Bash); Docker disk cleanup

> Implements the **2026-10-17 "Setup and deploy scripts work from Windows (Git Bash);
> Docker disk cleanup"** entry in [`MIGRATION.md`](../../MIGRATION.md).
>
> **Applies to every fork.** Lets the app owner run `setup.sh`, `make` targets and
> deploys from **Git Bash on Windows**, keeps scripts checked out with LF so the
> container doesn't exit before logging, and bounds local Docker disk use after each
> build (all OSes). **Scripts, Makefile, `.gitattributes`, Dockerfile, `package.json` —
> no app code, no schema, no SSM, no infra.** Nothing to deploy to adopt it.

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

You are making the **setup and deploy scripts** of the **current project** (an
existing Mapp Labs app) work from **Git Bash on Windows**, without changing their
behaviour on macOS or Linux, and adding a post-push Docker disk cleanup that applies on
every OS.

The authoritative reference implementation is a fresh checkout of `labs-app-template`
at:

    <TEMPLATE_PATH>

If that path is still the literal placeholder, is empty, or doesn't look like a
`labs-app-template` checkout (no `docs/template/WINDOWS.md`, no `to_node_path` in
`scripts/deploy/_config.sh`), **stop and ask me for the correct path before doing
anything else.** Also remind me I should have pulled the **latest** template into that
directory, and tell me its version.

### Who I am

Assume I may **not** be a developer. **You** own the git branch. Explain what you
changed in plain language. Do not assume I can fill gaps myself.

### Operating principles (read these before touching anything)

1. **The template is the reference design, not a literal source to copy.** Deploy
   scripts are often customised per app. Copy a file verbatim only if this app's copy
   matches the template's previous version; otherwise port each change into it.
2. **Above all, do not break deploys on macOS/Linux.** Every Windows-specific branch is
   guarded by `uname -s` matching `MINGW*` / `MSYS*`. Keep it that way. macOS ships
   bash **3.2** — no bash-4 features (associative arrays, `${var,,}`, `mapfile`), and
   empty arrays under `set -u` must use the `${arr[@]+"${arr[@]}"}` form.
3. **Surface every deviation** from the template and why.
4. **Never deploy, and never run a mutating AWS command.** Read-only checks only.
5. **When something is genuinely complex, risky, or ambiguous and I can't answer, tell
   me to get help — don't guess.** Point me to **#topic-mapp-labs** or
   **#topic-ai-support**.

### Step 0 — Branch and assess

1. Create a git branch (e.g. `retrofit/windows-git-bash`). All work goes here.
2. Read, in the template: the **2026-10-17** Windows entry in `MIGRATION.md`;
   `docs/template/WINDOWS.md`; `scripts/deploy/_config.sh`;
   `scripts/deploy/build-and-push.sh`; `scripts/deploy/register-keycloak-uris.sh`;
   `scripts/setup.sh`; `scripts/refresh-labs-aws-creds.sh`; `.gitattributes`; the
   `MSYS2_ARG_CONV_EXCL` block and `dev-check-prerequisites` in the `Makefile`; the
   entrypoint lines in the `Dockerfile`; `build:debug` in `package.json`.
3. **Detect what is already applied:**

   ```bash
   grep -n "to_node_path\|add_exit_trap\|run_python\|MSYS2_ARG_CONV_EXCL\|AWSCLIV2" scripts/deploy/_config.sh
   grep -n "MSYS2_ARG_CONV_EXCL" Makefile
   grep -n "eol=lf" .gitattributes
   grep -n "docker-entrypoint" Dockerfile   # template: a sed CR strip before chmod
   grep -n "docker-credential-ecr-login\|DOCKER_CLEANUP" scripts/deploy/build-and-push.sh
   grep -n "CURL_TLS_ARGS" scripts/deploy/register-keycloak-uris.sh
   grep -n '"build:debug"' package.json
   ```

   Tell me what is present. If everything is, record `applied` and stop.
4. **Find every script that needs the helpers.** List all call sites that would break
   on Windows:

   ```bash
   grep -rnE "node -p \"require\('\\$|node -p \"require\('\./|require\('\\$\{" scripts Makefile
   grep -rn "python3 " scripts
   grep -rn "trap .* EXIT" scripts
   grep -rnE "aws [a-z-]+ .*--(name|path|log-group-name)[ =]\"?/" scripts Makefile
   ```

   Also note any `aws` / `curl` / `node` argument starting with `/` whose prefix is
   **not** in the template's list (`/{app}-`, `/labs`, `/mapp-labs`, `/ecs/`, `/aws/`,
   `/app/`) — this app may use more. Show me the list.
5. **Check line endings before adding `.gitattributes`:**

   ```bash
   git ls-files --eol | grep -E "i/crlf|i/mixed"
   ```

   Anything listed is committed with CRLF. Pay particular attention to
   `prisma/migrations/**/migration.sql` — see Step 3.

### Step 1 — `_config.sh` helpers

Port into this app's `scripts/deploy/_config.sh`, in the template's positions:

1. `to_node_path` and `add_exit_trap` (near the top, before first use).
2. Every `node -p "require('${PROJECT_ROOT}/…')…"` becomes
   `node -p "require(process.argv[1])…" "$(to_node_path …)"` — the path is an
   argument, never interpolated into JS.
3. The MINGW/MSYS-only `aws` PATH fallback, `PYTHON_BIN` selection and `run_python`
   (with the non-Windows `run_python` defined as plain `python3`).
4. The MINGW/MSYS-only `MSYS2_ARG_CONV_EXCL` block, **plus any extra prefix from
   Step 0.4**, keeping it idempotent and preserving a user-set value.

### Step 2 — Scripts and Makefile

1. Apply `to_node_path` to every call site from Step 0.4 (`deploy-app.sh`,
   `maintenance-deploy.sh`, `icinga-monitoring.sh`, `set-ecr-lifecycle.sh`,
   `build-and-push.sh` — which should read `${PROJECT_ROOT}/package.json`, not
   `./package.json` — and any script the app added).
2. Replace `python3` with `run_python` in scripts that source `_config.sh`
   (`maintenance-deploy.sh`, `update-keycloak-ca.sh`, and the app's own). Standalone
   scripts (`scripts/refresh-labs-aws-creds.sh`) inline the selection as the template
   does.
3. Replace any `trap '…' EXIT` that could clobber another with `add_exit_trap`.
4. **`build-and-push.sh`:** port the Windows ECR-login branch
   (`docker-credential-ecr-login` via a throwaway `DOCKER_CONFIG`, removed with
   `add_exit_trap`; plain `docker login` with an install hint otherwise) and the
   post-push cleanup (`DOCKER_CLEANUP`, `DOCKER_BUILD_CACHE_MAX`, untag by reference
   only within `${ECR_URI}`, never by image ID, never `-f`, never failing the deploy).
5. **`register-keycloak-uris.sh`:** port the `CURL_TLS_ARGS` block (temp bundle =
   Git's public bundle + `certs/ca.internal.mapp.tools.crt`, `--ssl-revoke-best-effort`)
   and expand it as `${CURL_TLS_ARGS[@]+"${CURL_TLS_ARGS[@]}"}`. If the app has no
   `certs/ca.internal.mapp.tools.crt`, it has not taken the 2026-06-18 internal-CA
   retrofit — skip this block and note it. Add the `winget install jqlang.jq` hint.
6. **`Makefile`:** add the `MSYS2_ARG_CONV_EXCL` export (same list as `_config.sh`,
   including your extras) and the `jq` line in `dev-check-prerequisites`. **`setup.sh`:**
   its own `to_node_path`, the node call sites, and the `jq` check.
7. **`package.json`:** if `build:debug` (or any other script) uses `VAR=value cmd`,
   rewrite it the template's way (`node -e` + `spawnSync`, no new dependency).

### Step 3 — Line endings

1. Add the template's `eol=lf` block to `.gitattributes` (keep the app's existing
   lines).
2. Add the CR strip next to the entrypoint `chmod` in the `Dockerfile`.
3. If Step 0.5 listed nothing, you're done. Otherwise run
   `git add --renormalize .` and show me `git status`. **If any listed file is an
   already-applied `migration.sql`, stop and ask me:** normalising it changes its
   checksum, and Prisma will report that migration as modified against databases where
   it was applied with CRLF. The safe default is to leave those files out
   (`git restore --staged <file>`) and note it as a deviation.
4. Commit the renormalisation as its own commit, so it is easy to review.

### Step 4 — Docs

Copy `docs/template/WINDOWS.md` into the app's template docs folder
(`docs/template/` on the 2026-10-17 docs layout, else `docs/`), and add the Windows /
`jq` rows to the prerequisites table in `AGENTS.md` if the app has one. If the app has
its own deploy doc, mention `DOCKER_CLEANUP` / `DOCKER_BUILD_CACHE_MAX` there.

### Guardrails (do NOT do these)

- Do **not** add any behaviour change outside a `MINGW*|MSYS*` guard, except the Docker
  cleanup and the `jq` checks.
- Do **not** use bash-4-only syntax, or a bare `"${arr[@]}"` on a possibly-empty array.
- Do **not** prune Docker images by ID or with `-f`, or touch images outside this app's
  ECR repo.
- Do **not** renormalise `migration.sql` files without my say-so (Step 3.3).
- Do **not** deploy or run mutating AWS commands.

### Verify and hand back

- `bash -n` every script you changed. On macOS, `/bin/bash -n` too (bash 3.2).
- Run read-only checks on this machine: `make dev-check-prerequisites`,
  `make staging-ecs-status`. `bash scripts/deploy/register-keycloak-uris.sh staging`
  is the real bash-3.2 test for the `CURL_TLS_ARGS` change, but it writes to Keycloak
  (idempotently, this app's own redirect URIs only, needs VPN) — **ask me before
  running it**. On macOS this proves you didn't regress it; tell me Windows still
  needs a real run.
- `npm run build:debug` starts (you may stop it once `next build` is running).

### Record state

Before the handback, write/update **`.retrofit-state.json` at this app's repo root**
(create it if absent), following `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.
Upsert this retrofit under `retrofits["2026-10-17-windows-git-bash"]` with `status`
(applied / partial / skipped / not-applicable), `templateVersion` + `templateRef`, an
ISO-8601 UTC `at` (`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, `notes` + any `deviations`
(extra `MSYS2_ARG_CONV_EXCL` prefixes, files left out of renormalisation, skipped CA
block). Refresh `template.lastRetrofitAgainstVersion` / `lastRetrofitAgainstRef` /
`lastRetrofitAt`; don't remove other entries.

Then give me a **plain-language handback**:

1. Which scripts you changed, and any extra path prefixes this app needed.
2. Whether any files were committed with Windows line endings, and what you did.
3. Any **deviations** from the template and why.
4. **How to ship it:** nothing to deploy — the scripts take effect the next time
   someone runs them. The `Dockerfile` change rides along with the next ordinary
   `make staging-deploy`.
5. **What to check:** a Windows user runs `make staging-ssm-list` and a staging deploy
   from Git Bash (see `docs/template/WINDOWS.md` for what to install first); anyone
   deploying sees "Cleaning up local Docker build files" at the end of the build step
   (set `DOCKER_CLEANUP=false` to skip it).
6. If anything got complicated and I didn't have an answer, remind me I can ask in
   **#topic-mapp-labs** or **#topic-ai-support**.

## PROMPT END
