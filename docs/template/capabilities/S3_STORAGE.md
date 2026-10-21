# S3 Storage (images & files)

**Type:** Standard (wired into the template's admin UI)
**Module:** `src/modules/s3_images/`
**Dependencies:** None

## Overview

Upload, process, and serve images and files from a per-app S3 bucket. Images get
automatic WebP conversion, JPEG fallback, and optional size variants. Non-image
files (PDFs, spreadsheets, archives) go through the same upload path.

Unlike most capabilities this one is **already used by the template**: admin
profile images, `AccessManagementTable`, and several modals render through
`S3ImageDisplay`. Removing it is not a no-op.

## Access model — read this before adding a route

Access is decided in exactly one place:
**`src/modules/s3_images/config/prefixes.ts`**. Every key belongs to a declared
prefix, and each prefix declares who may read and who may write:

| Prefix | Read | Write | For |
|---|---|---|---|
| `public/` | **public** | admin | Deliberately world-readable assets (logos, marketing images) |
| `content/` | authenticated | authenticated | General uploads: images, documents, media |
| `mapp-team/` | authenticated | **admin** | Team member profile images |
| `temp/` | authenticated | authenticated | Short-lived scratch uploads |

A key matching no declared prefix is **rejected** — there is no permissive
default. To add a prefix, add it to `S3_PREFIXES` with explicit `read` and
`write` levels.

`content/` is authenticated, not public. It is the default upload destination
and it accepts non-image files, so serving it publicly meant any document
uploaded through `/api/upload` was readable by an unauthenticated caller holding
the key. Publishing something is now a deliberate act: put it in `public/`,
which is admin-write for that reason.

> **Adding a route that serves S3 objects?** Call `authorizeS3Read(key)` from
> `@/modules/s3_images/server/authorize` and honour its result. Do not re-derive
> access rules inline — that is exactly how `/api/images` and `/api/files` came
> to disagree with each other. `getPresignedUrl` validates the key too, so a
> route that forgets still cannot mint a URL for an undeclared prefix, but it
> *will* skip the session check.

### What this does NOT protect against

`S3ImageService.getPublicUrl()` returns a **direct** URL —
`https://{bucket}.s3.{region}.amazonaws.com/{key}`, or a CloudFront URL when
`CLOUDFRONT_DOMAIN` is set. That URL is stored on the `S3Image` record and does
not pass through this app, so **none of the access control above applies to it.**

Those URLs fail closed only because the bucket blocks public access. AWS enables
Block Public Access by default on buckets created since April 2023, and the
template's buckets are created by hand (`aws s3 mb`, see
[DEPLOYMENT.md](../DEPLOYMENT.md)) rather than by CDK — so nothing here verifies
it. **Verify it once per environment:**

```bash
aws s3api get-public-access-block --bucket mapp-labs-{appName}-{staging|prod} \
  --profile labs-power
# All four settings must be true.
```

If they are not all `true`, every object in the bucket is world-readable
regardless of the prefix policy, and fixing that matters more than anything else
on this page:

```bash
aws s3api put-public-access-block --bucket mapp-labs-{appName}-{env} \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
  --profile labs-power
```

Note that with Block Public Access on, the `public/` prefix is "public" in the
sense that *this app* serves it to anonymous callers via a presigned URL — not
that S3 serves it directly.

## Per-app isolation

Each app gets its own bucket **per environment**:
`mapp-labs-{appName}-staging` and `mapp-labs-{appName}-prod`
(`infra/lib/config/environments.ts`). The ECS task role is granted read/write on
that bucket only (`infra/lib/stack.ts`), optionally narrowed further by
`config.s3Prefix` (empty by default). So unlike the `sftp` capability — where
confinement is enforced by application code — isolation here is enforced by IAM.

## Authentication

Static IAM credentials from env (`S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`).
In ECS the task role also applies. Uploads require a session; see the table
above for which prefixes each role may write.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `S3_REGION` | Yes | Bucket region (`eu-central-1`) |
| `S3_BUCKET_NAME` | Yes | `mapp-labs-{appName}-{env}`; injected by CDK in ECS |
| `S3_ACCESS_KEY_ID` | Local only | Not needed in ECS (task role) |
| `S3_SECRET_ACCESS_KEY` | Local only | Not needed in ECS (task role) |
| `S3_MAX_FILE_SIZE` | No | Megabytes, default 100 |
| `CLOUDFRONT_DOMAIN` | No | CDN domain for `getPublicUrl`. See the caveat above |

## Database Schema Changes

None. `S3Image` is stored as JSON on existing models.

## Module API

```typescript
import { S3ImageService, S3ImageUpload, S3ImageDisplay } from '@/modules/s3_images';

const service = S3ImageService.getInstance();
const image = await service.uploadImage(file, { path: 'content', generateVariants: true });
const url = await service.getPresignedUrl(image.key, 3600);
```

Server-side authorization helpers:

```typescript
import { authorizeS3Read, authorizeS3Write } from '@/modules/s3_images/server/authorize';
import { parsePathName, resolveS3Key, S3_PREFIXES } from '@/modules/s3_images/config/prefixes';
```

`parsePathName` narrows an untrusted `path` form field to a declared prefix and
throws `S3KeyError` otherwise — always use it rather than casting.

### Routes

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/upload` | any signed-in user | Upload; prefix write level enforced |
| `POST /api/admin/upload` | admin | Upload with `withSecurity` wrapper |
| `GET /api/images/[...path]` | per prefix | Presigned URL, image cache headers |
| `GET /api/files/[...path]` | per prefix | Presigned URL, download headers |

Neither `GET` route is in the middleware matcher (`src/proxy.ts`) — the
authorization in the route is the only gate.

## Upload validation

Enforced server-side on both upload routes: MIME allowlist, executable-extension
blocklist, double-extension check, magic-byte content verification
(`comprehensiveFileVerification`), a size cap, and rate limiting on
`/api/upload`. An allowlist at write time is why the read routes no longer carry
an extension blocklist.

## Example Use Cases

- Admin profile images and team photos (what the template uses it for today).
- Customer-uploaded documents that only signed-in users may retrieve.
- Public marketing assets, via `public/`.

## Anti-patterns

- **Do not put private files in `public/`.** It is served to anonymous callers.
- **Do not re-derive access rules in a new route.** Use `authorizeS3Read`.
- **Do not cast the `path` form field.** Use `parsePathName`.
- **Do not assume `s3Image.url` is access-controlled.** It is a direct S3 or CDN
  URL. Use the API routes when access should be checked.

## Reference

- `src/modules/s3_images/config/prefixes.ts` — the policy and its tests
- `docs/template/capabilities/SFTP.md` — the same problem where IAM *cannot* help
- MIGRATION.md, 2026-08-22 — the access-model rewrite
