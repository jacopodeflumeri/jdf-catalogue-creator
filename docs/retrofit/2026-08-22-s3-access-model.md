# Retrofit prompt — S3 access model (fixes anonymous read of `content/`)

> Implements the **2026-08-22 "S3 access model"** entry in
> [`MIGRATION.md`](../../MIGRATION.md).
>
> **Applies to every fork.** The S3 module is wired into the template's admin UI
> (profile images, access tables), so almost every app has it. The version that
> shipped until 2026-08-22 served **every object under `content/` to
> unauthenticated callers** via `/api/images/[...path]`, while `content/` is the
> default upload destination and accepts non-image files.
>
> **Breaking:** `content/` now requires a session. If your app renders S3 images
> on a logged-out page, those objects must move to the new `public/` prefix —
> section 5 walks it.
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

You are applying a **security fix to the S3 access model** of the **current
project** (an existing Mapp Labs app built on `labs-app-template`).

The authoritative reference is a fresh checkout of `labs-app-template` at:

    <TEMPLATE_PATH>

If that path is the literal placeholder, empty, or not a `labs-app-template`
checkout (no `src/modules/s3_images/config/prefixes.ts`, no
`docs/template/capabilities/S3_STORAGE.md`), **stop and ask me for the correct path.**
Also remind me to have pulled the **latest** template, and tell me its version.

### Who I am

Assume I may **not** be a developer. **You** own the git branch and the code
changes. Running AWS CLI commands, moving S3 objects, and deploying are steps for
me or a technical person. Explain everything in plain language.

### Operating principles

1. **The template is the reference design, not a literal source to copy.**
2. **Above all, do not break this app.** Prefer the safest change.
3. **Surface every deviation** and why.
4. **Do not deploy, and do not move or delete S3 objects yourself.**

---

### 0. Branch before you touch anything

1. Run `git status`. If the working tree has **uncommitted changes**, stop and
   tell me — I may have work in progress. Do not stash, reset, or discard
   anything on my behalf; wait for me to say how to handle it.
2. Create a branch (e.g. `retrofit/s3-access-model`) and do **all** work there. Never commit
   to `main`/`master`.
3. Do not delete or rewrite any file until you have read it and the assessment
   below is done. This retrofit changes app behaviour on purpose, but nothing
   here is a reason to lose work that already exists.

---

### 1. Does this apply? (fast check)

Look for `src/modules/s3_images/` and `src/app/api/images/[...path]/route.ts`.

- **Neither exists** → this app does not use the template's S3 module. Tell me it
  doesn't apply and stop.
- **They exist** → continue.

---

### 2. Assess the exposure, and report before fixing

Read this app's `src/app/api/images/[...path]/route.ts` and report in plain
language:

1. **Does it serve any prefix without a session?** In the shipped version
   `content/` was in a `publicPaths` array checked before any auth. A fork may
   have added prefixes to that array.
2. **Does `/api/upload` require admin, or just any signed-in user?** The shipped
   version checked only `session?.user`, so a customer-role session could upload.
3. **Where does `/api/upload` default the `path` field?** Shipped default was
   `content` — the same prefix served publicly.
4. **What is actually stored under `content/`?** Ask me. If the app has ever
   uploaded documents, contracts, exports, or anything customer-specific there,
   the exposure is real rather than theoretical.
5. **Is the app deployed?** If yes, this is live.

Then explain the shape of the bug: two sibling routes read the same bucket, and
`/api/files/[...path]` required a session for `content/` while
`/api/images/[...path]` did not — so the file route's protections were bypassable
by asking for the same key through the image route. Neither route is in the
middleware matcher, so the in-route check is the only gate.

**Then ask me whether to proceed.**

---

### 3. Port the access model

Copy from the fresh template:

- `src/modules/s3_images/config/prefixes.ts` (new — the whole policy)
- `src/modules/s3_images/server/authorize.ts` (new)
- `src/modules/s3_images/config/__tests__/prefixes.test.ts` (new)

Then port these, adapting to whatever this app has diverged into:

- `src/app/api/images/[...path]/route.ts` and
  `src/app/api/files/[...path]/route.ts` — thin wrappers over `authorizeS3Read`.
- `src/app/api/upload/route.ts` and `src/app/api/admin/upload/route.ts` —
  `parsePathName` for the destination, `authorizeS3Write` for the level.
- `src/modules/s3_images/config/s3-config.ts` — `paths` derived from
  `S3_PREFIXES`.
- `src/modules/s3_images/services/s3-image-service.ts` — `resolveS3Key` inside
  `getPresignedUrl`, and `crypto.randomUUID()` instead of `Math.random()` for
  key generation.

**If this app has extra routes that serve S3 objects, they are the whole point of
the exercise — find them.** Search for `getPresignedUrl`, `S3ImageService`,
`getPublicUrl`, and any route under `src/app/api/` that takes a key or path. Each
one must call `authorizeS3Read` and honour the result. List every one you
changed.

**If this app declares its own prefixes** beyond `content/`, `mapp-team/`,
`temp/`, add them to `S3_PREFIXES` with explicit `read` and `write` levels — ask
me what each is for rather than guessing. A prefix that is not declared will be
**rejected**, so missing one breaks that feature.

Run `npx tsc --noEmit` and `npx jest src/modules/s3_images`.

---

### 4. Old → new

| Old | New |
|---|---|
| `GET /api/images/content/...` anonymous | Requires a session |
| `path` form field cast, unknown value coerced to `content` | `parsePathName`, 400 on unknown |
| `/api/upload` could write `mapp-team/` | Admin only |
| `S3_CONFIG.paths` (3 entries) | 4, including `public` |
| `'content' \| 'mappTeam' \| 'temp'` | `S3PathName` from `config/prefixes` |
| Extension blocklist in `/api/files` | Removed; upload-time MIME allowlist covers it |

---

### 5. Find anything that breaks (do this before handing back)

`content/` now needs a session. Two things to check:

1. **Logged-out pages rendering S3 images.** Search this app's public routes
   (anything not under `/admin` or `/account` — typically a landing page,
   `/contact`, `/privacy`, error pages) for `S3ImageDisplay`, `s3Image.url`, or
   `/api/images/`. Anything reachable while logged out that renders a `content/`
   object **will break**.

   For each one, tell me: the page, the object, and that the fix is to move that
   object to the `public/` prefix and re-point the record. **Give me the `aws s3
   cp` commands — do not run them.** Do not "fix" it by making `content/` public
   again.

2. **`s3Image.url` used directly as an `<img src>`.** That is a direct S3/CDN URL
   which never passed through the app, so it is unaffected by this change — but
   it also means it was never access-controlled. Note every place it is used
   directly so I know what is relying on it.

---

### 6. Ask me to verify the bucket (this matters more than the code)

`getPublicUrl()` returns a direct S3 or CloudFront URL, stored on the `S3Image`
record, which bypasses every check above. It fails closed **only** because the
bucket blocks public access, and the buckets are created by hand rather than by
CDK, so nothing verifies it.

Give me this to run for each environment, and tell me all four settings must be
`true`:

```bash
aws s3api get-public-access-block --bucket <bucket-name> --profile labs-power
```

If any is false, tell me plainly that every object in that bucket is currently
world-readable regardless of the code change, and that fixing it takes priority.

---

### 7. Hand back

Commit to the branch from section 0 and give me a plain-language summary with:

1. **Whether this app was exposed**, what was readable, and for how long if the
   app is deployed.
2. Every route you changed, and every extra S3-serving route you found.
3. **What will break and what I must move to `public/`**, with the commands.
4. The bucket verification result, or the command if I need to run it.
5. Record the retrofit in `.retrofit-state.json` per
   `<TEMPLATE_PATH>/docs/retrofit/RETROFIT-STATE.md`.

Do **not** deploy. Do **not** move or delete S3 objects yourself.

## PROMPT END
