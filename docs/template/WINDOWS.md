# Developing and deploying from Windows

The template works on Windows through **Git Bash** (from Git for Windows). The
Makefile and every script under `scripts/` are bash; **cmd.exe and PowerShell
are not supported** for `make` targets or scripts. Plain `npm run ...` scripts do
work from any shell.

Everything below is handled in the scripts already; this page lists what you
must install and the few habits that keep a Windows checkout healthy.

## Install

| Tool | Needed for | Install (examples — any equivalent works) |
|---|---|---|
| Git for Windows (Git Bash) | Everything | https://git-scm.com/download/win, or `winget install Git.Git` |
| `make` | Every `make` target (Git Bash doesn't ship it) | `winget install ezwinports.make`, or `choco install make`, or MSYS2 `pacman -S make` |
| Node.js 22+ | Everything | https://nodejs.org/ |
| PostgreSQL (`psql`, `createdb`) | Local DB and DB tests | EDB installer, then add its `bin` to `PATH` — see [LOCAL-POSTGRES.md](LOCAL-POSTGRES.md#windows) |
| `jq` | Deploys (Keycloak URI registration) | `winget install jqlang.jq` |
| AWS CLI v2 | All AWS operations | The MSI from AWS |
| Session Manager plugin | ECS Exec (remote migrations, seeding, maintenance deploys) | The MSI from AWS |
| Python 3 | Small JSON/URL helpers in the deploy scripts | **python.org** installer (tick "Add python.exe to PATH") |
| Docker (Rancher Desktop or Docker Desktop) | Building and pushing images | Either; both ship `docker-credential-ecr-login` |
| `docker-credential-ecr-login` | ECR login from Windows | Comes with the above; otherwise the `windows-amd64` binary from https://github.com/awslabs/amazon-ecr-credential-helper/releases, on `PATH` |

**Open a new Git Bash window after each install** — a window opened before an
installer ran doesn't see the new `PATH`.

What the scripts do for you:

- **AWS CLI**: if `aws` isn't on `PATH`, `scripts/deploy/_config.sh` falls back to
  the installer's default `C:\Program Files\Amazon\AWSCLIV2`.
- **Python**: on Windows `python3` is often the Microsoft Store stub that just
  prints an install hint. The scripts pick the first of `python3` / `python` that
  really runs Python 3, so install from python.org rather than the Store.
- **ECR login**: `docker login` stores the token in Windows Credential Manager,
  which holds at most 2,560 bytes; ECR tokens from an SSO session are often
  longer and the login fails with *"The stub received bad data."*
  `build-and-push.sh` therefore uses a throwaway Docker config that hands ECR to
  `docker-credential-ecr-login` (your other Docker settings are kept). If the
  helper isn't on `PATH`, it prints a hint and falls back to `docker login`.
- **Keycloak registration**: Git Bash's curl (Schannel) doesn't trust Mapp's
  internal root CA, so `register-keycloak-uris.sh` passes it the public bundle
  plus the vendored internal root and makes revocation checks best-effort.
- **Paths to node**: Git Bash paths (`/c/Users/...`) are converted with
  `to_node_path` (`cygpath -m`) before they reach `node`.

## Line endings

A script checked out with CRLF breaks: a CRLF `docker-entrypoint.sh` makes the
container exit 255 before it can log anything (empty CloudWatch log, ECS circuit
breaker on the first deploy). So:

- `.gitattributes` forces LF for `*.sh`, `*.sh.example`, `*.py`, `Makefile`,
  `Dockerfile`, `.githooks/*`, `*.crt` and `*.sql` (Prisma checksums migration
  files, so a CRLF checkout would make a migration look modified). Keep new
  executable or parsed file types in that list.
- Set `git config --global core.autocrlf input` so git never converts to CRLF on
  checkout.
- **Apps forked before `.gitattributes` existed and checked out on Windows:** add
  the template's `.gitattributes`, then run once and commit the result:
  ```bash
  git add --renormalize .
  ```
- The Dockerfile also strips CR from the entrypoint as a safety net, but don't
  rely on it for other scripts.

## Executable bit

Windows filesystems don't carry Unix permissions, so `chmod +x` in Git Bash
doesn't reach git. When you add a script, set the bit in the index:

```bash
git update-index --chmod=+x scripts/deploy/my-new-script.sh
```

(This applies to copied `*.sh.example` files too, e.g. the Data Sync wrappers.)

## Path conversion (`MSYS2_ARG_CONV_EXCL`)

Git Bash rewrites any argument passed to a native Windows program (`aws`, `node`,
`curl`, `docker`) that starts with `/` into a Windows path:
`/labs/x` → `C:/Program Files/Git/labs/x`. That breaks SSM parameter names
("Parameter name must be a fully qualified name", or a false "not found"),
CloudWatch log groups and container paths sent through ECS Exec.

`scripts/deploy/_config.sh` and the `Makefile` both export
`MSYS2_ARG_CONV_EXCL` with exactly these prefixes:

```
/{appName}-   this app's SSM namespace
/labs         shared SSM (/labs/*, /labs-stg/*, /labs-prod/*)
/mapp-labs    shared SSM (/mapp-labs/*, /mapp-labs-stg/*, /mapp-labs-shared/*)
/ecs/         CloudWatch log groups
/aws/         AWS-managed names
/app/         paths inside the container
```

Real file paths (`mktemp`, `/tmp/...`) are still converted, which the Windows
tools need. **When you add an `aws`/`curl`/`node` call whose argument starts with
a new `/` prefix that is not a local file, add the prefix to both lists** —
`_config.sh` and the Makefile must stay identical.

## Helpers for script authors

`scripts/deploy/_config.sh` (sourced by every deploy script) provides:

- **`run_python`** — use instead of calling `python3` directly:
  `value="$(run_python -c 'print(42)')"`. It uses the Python the loader found, and
  on Windows strips the CR that Windows Python writes to stdout (otherwise
  `"RUNNING\r" != "RUNNING"`), preserving the exit status.
- **`add_exit_trap '<cmd>'`** — appends to the `EXIT` trap instead of replacing
  it, so cleanups from different parts of a script all run. Use it for temp
  files and directories.
- **`to_node_path <path>`** — converts a Git Bash path for `node`; pass the
  result as an argument (`process.argv[1]`), never interpolated into JS source.

Standalone scripts that don't source `_config.sh` (e.g.
`scripts/refresh-labs-aws-creds.sh`) inline the same Python selection.

Also keep `package.json` scripts shell-neutral: `VAR=value cmd` is POSIX syntax
and fails under cmd.exe, which npm uses on Windows (see how `build:debug` sets
`ENABLE_SOURCE_MAPS` through `node -e`).

## Docker disk use

Every build leaves several GB of build cache and an image behind; after a day of
deploys that can fill a laptop drive (Docker then fails with "read-only file
system"). After each push, `build-and-push.sh` prunes the build cache down to
`DOCKER_BUILD_CACHE_MAX` (default `10GB`) and untags this app's local images
(only references in this app's ECR repo; every pushed version stays in ECR). It
never fails the deploy. Opt out with `DOCKER_CLEANUP=false`; this applies on every
OS (see [DEPLOYMENT.md](DEPLOYMENT.md)).
