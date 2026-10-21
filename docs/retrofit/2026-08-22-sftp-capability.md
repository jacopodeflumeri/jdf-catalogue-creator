# Retrofit prompt — SFTP rewrite (unauthenticated file read + path traversal)

> Implements the **2026-08-22 "SFTP capability (rewrite)"** entry in
> [`MIGRATION.md`](../../MIGRATION.md).
>
> **Mandatory for any fork that has `src/modules/sftp/`** — the version shipped
> in the template from the initial commit until 2026-08-22 exposes an
> **unauthenticated server action that reads any file the SFTP service account
> can reach**, and confines nothing to `SFTP_ROOT_PATH`. If your app has that
> directory, treat this as a security fix, not a feature upgrade.
>
> **Optional** for everyone else: the same change turns SFTP into a registered
> capability. If your app doesn't use SFTP, the whole retrofit is a two-minute
> check and a deletion.
>
> **Breaking on purpose.** Every server action signature changes and one export
> is removed outright. Section 5 has the old → new table.
>
> **No Prisma schema changes. No infra changes. No deploy performed by this
> prompt.**

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

You are applying a **security fix and rewrite of the SFTP module** to the
**current project** (an existing Mapp Labs app built on `labs-app-template`).

The authoritative reference is a fresh checkout of `labs-app-template` at:

    <TEMPLATE_PATH>

If that path is the literal placeholder, empty, or not a `labs-app-template`
checkout (no `src/modules/sftp/lib/paths.ts`, no `docs/template/capabilities/SFTP.md`),
**stop and ask me for the correct path.** Also remind me to have pulled the
**latest** template, and tell me its version.

### Who I am

Assume I may **not** be a developer. **You** own the git branch and the code
changes. Obtaining the SFTP host key fingerprint, changing credentials, asking
the SFTP host operator to chroot the account, and deploying are steps for me or
a technical person. Explain everything in plain language.

### Operating principles (read before touching anything)

1. **The template is the reference design, not a literal source to copy.** Match
   its model and conventions; adapt to this app.
2. **Above all, do not break this app.** Prefer the safest change.
3. **Surface every deviation** and why.
4. **Do not deploy.** Branch, change, hand back.

---

### 0. Branch before you touch anything

1. Run `git status`. If the working tree has **uncommitted changes**, stop and
   tell me — I may have work in progress. Do not stash, reset, or discard
   anything on my behalf; wait for me to say how to handle it.
2. Create a branch (e.g. `retrofit/sftp-rewrite`) and do **all** work there. Never commit
   to `main`/`master`.
3. Do not delete or rewrite any file until you have read it and the assessment
   below is done. This retrofit changes app behaviour on purpose, but nothing
   here is a reason to lose work that already exists.

---

### 1. Does this apply to my app? (decide first, it's fast)

Check for `src/modules/sftp/` in this project.

- **Directory does not exist, and nothing imports `@/modules/sftp`** → this
  retrofit is **optional**. Ask me whether the app needs to exchange files with
  an external party that only speaks SFTP (a customer dropping feed files, a
  partner collecting exports). If **no**, tell me it doesn't apply and stop —
  don't add it "just in case." If **yes**, skip to section 6.
- **Directory exists** → **continue, this is mandatory.** Do section 2 first and
  report before doing anything else.

---

### 2. Assess the exposure, and tell me before you fix it

Read `src/modules/sftp/lib/actions.ts` in **this app** and report, in plain
language:

1. **Is there an export with no auth guard?** In the shipped template version it
   was `downloadSFTPFileForCustomer`, but a fork may have renamed it, copied it,
   or added more. **Check every export**, not just that name. An export is
   unguarded if it does not call `requireAdmin()` / `getAdminSession()` /
   equivalent before doing any work.
2. **Is any path confined to `SFTP_ROOT_PATH`?** In the shipped version, nothing
   was: `getSFTPRootPath()` was only ever read to display the value, and
   `normalizePath()` did not resolve `..`. Confirm whether that's still true
   here.
3. **What can the SFTP service account read?** Ask me, or check whether the
   account is chrooted. This determines how bad an unguarded read is.
4. **Is the app deployed?** If yes, the exposure is live right now.

Explain the impact to me in one short paragraph: *any* export in a `'use server'`
file is a public POST endpoint with a generated action id — reachable without a
session, without any UI referencing it, and **not** covered by middleware. So an
unguarded export there is an open endpoint on the public internet.

**Then ask me whether to proceed.** If the app is deployed and the exposure is
confirmed, say so plainly and recommend we fix it now.

---

### 3. Understand the new model before you write code

Read these in the fresh template, in order:

1. `docs/template/capabilities/SFTP.md` — especially **"Confinement, and what it does and
   does not guarantee."**
2. `src/modules/sftp/lib/paths.ts` — the resolver and its doc comment.
3. `src/modules/sftp/lib/actions.ts` — the header comment about `'use server'`.

The three things that changed conceptually:

- **Paths are app-relative.** Every path in the module's API is relative to
  `{SFTP_ROOT_PATH}/{appName from app.config.json}`. `/` means *this app's SFTP
  area*, never the remote filesystem root. `resolveSftpPath('/etc/passwd')`
  returns `{root}/etc/passwd`, a path inside your own area.
- **Per-app encapsulation.** The app's own directory is appended to
  `SFTP_ROOT_PATH`. Two apps built from this template and pointed at the same
  SFTP host can no longer overwrite each other's files. This mirrors how the
  `data_sync` capability isolates apps in S3.
- **That encapsulation is code-enforced, not IAM-enforced.** `data_sync` gets
  its isolation from AWS: a bug cannot cross the prefix because IAM refuses the
  call. SFTP has no equivalent — the confinement holds only as long as this
  module's code is correct. **Tell me, explicitly, at hand-back: the real
  boundary is chrooting the SFTP service account to the app's directory, and I
  need to ask whoever runs that host to do it.**

---

### 4. Port the module

**Inventory first, then replace.** Before overwriting anything, list every
export this app's SFTP module currently has and every place it is called from
(`grep` for `@/modules/sftp`). You need that list to be sure the port drops
nothing — write it into the branch as a scratch note if it is long.

Then replace this app's `src/modules/sftp/lib/` with the template's version:
`paths.ts`, `policy.ts`, `client.ts`, `actions.ts`, `utils.ts`. Also copy
`src/modules/sftp/server.ts`, `types/index.ts`, and the tests in
`src/modules/sftp/lib/__tests__/`.

Copy these **close to verbatim** — this is security-critical code and the app is
unlikely to have a good reason to diverge. But anything on your inventory that
the template does not have is **app functionality, not drift**: port each extra
function onto the new model (guard first, then `resolveSftpPath`, then the
operation) rather than dropping it, and list every one you changed. The only
export you delete outright is the unauthenticated one from section 2.

Then:

- **`src/config/env.ts`** — add `SFTP_HOST_FINGERPRINT`,
  `SFTP_ALLOW_UNKNOWN_HOST_KEY`, `SFTP_MAX_FILE_BYTES`,
  `SFTP_DISABLE_APP_PREFIX`, and update `featureFlags.sftp`. Match the template.
- **`.env.example`** — copy the SFTP block.
- **`app.config.json`** — add `"sftp"` to `enabledCapabilities` if the app uses it.
- **Components** — the template's `SFTPBrowser` / `SFTPFileUpload` are updated
  for the new envelope-returning actions. If this app has its own SFTP UI, update
  its call sites using the table in section 5 rather than replacing its UI.

Run `npx tsc --noEmit` and `npx jest src/modules/sftp` and fix what breaks.

---

### 5. Old → new (this is the breaking part)

| Old | New | Notes |
|---|---|---|
| `downloadSFTPFileForCustomer(path)` | **removed** | Unauthenticated. See below. |
| `downloadSFTPFile(path)` → `SFTPOperationResult` | `downloadSFTPFile(path)` → `SFTPOperationResult<SFTPDownloadData>` | Path is now app-relative |
| `listSFTPDirectory(path)` → `SFTPDirectoryListing` (threw on error) | → `SFTPOperationResult<SFTPDirectoryListing>` | Read `result.data`; no longer throws |
| `uploadSFTPFile({remotePath, fileData, originalFilename, filename})` | `uploadSFTPFile({directory, filename, fileDataBase64})` | Enforces policy server-side |
| `deleteSFTPFile(path)` | **removed** | Was a stub that always returned failure |
| `getSFTPRootPathConfig()` | `getSFTPAreaInfo()` | Returns `{root, appPrefixEnabled}` |
| `normalizePath` / `joinPath` / `getParentPath` from `lib/utils` | **removed** | They looked like sanitizers but didn't resolve `..`. Use `resolveSftpPath` |
| `<SFTPBrowser disableRootAccess>` | **removed** | `/` is now the app root, which is safe to browse |

**If this app calls `downloadSFTPFileForCustomer` from real customer-facing UI,
do not just delete it and move on.** Deleting it is still correct — it must not
survive — but tell me the feature will break, and propose the replacement: the
customer never supplies a path; the server looks up a file reference scoped to
that customer's company (`session.user.companyId` / `accountId`) and resolves the
path itself. Do not implement that scoping model without asking me first.

---

### 6. Configuration (for me to do — list it, don't guess)

- `SFTP_HOST_FINGERPRINT` is **required**. Without it the client accepts any host
  key, letting anyone on the network path impersonate the server and capture the
  credential. Give me the exact command:
  `ssh-keyscan -t ed25519 <the host> | ssh-keygen -lf -`
- If the SFTP directory layout is dictated by the counterparty and cannot take a
  per-app subdirectory, `SFTP_DISABLE_APP_PREFIX=true` removes it — but say
  clearly that we then depend entirely on a server-side chroot.
- **Moving existing files.** If the app already has files on the host directly
  under `SFTP_ROOT_PATH`, they are now outside the app's area and the app will
  not see them. Tell me this and give me the `mv` to run. **Do not move files
  yourself.**

---

### 7. Hand back

Commit to the branch from section 0 and give me a plain-language summary
containing:

1. **Whether this app was exposed**, and if so what an attacker could have read.
   If it was deployed, say so — I may need to rotate the SFTP credential and ask
   for host access logs.
2. Every call site you changed, and anything that will behave differently.
3. **The chroot request** — the sentence I need to send to whoever runs the SFTP
   host.
4. What I must set before this works: `SFTP_HOST_FINGERPRINT`, and any file move.
5. Record the retrofit in `.retrofit-state.json` per
   `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.

Do **not** deploy. Do **not** rotate credentials yourself.

## PROMPT END
