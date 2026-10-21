# SFTP

**Type:** Optional
**Module:** `src/modules/sftp/`
**Dependencies:** None

## Overview

File exchange with **one** external SFTP endpoint, using a service account the
app owns. It exists for the case SFTP is actually good at: a counterparty who
only speaks SFTP — a customer dropping feed files, a partner collecting exports,
a legacy system that cannot be given an S3 bucket.

It is **not** a general file store. If you control both ends, use S3
(`src/modules/s3_images/`) or the `data_sync` capability instead — you get IAM,
lifecycle policies, and no long-lived password.

Everything the app does over SFTP is confined to a per-app directory. Read the
next section before you wire this up; it is the part that is easy to get wrong.

## Confinement, and what it does and does not guarantee

Every path this module touches resolves under:

```
{SFTP_ROOT_PATH}/{appName from app.config.json}
```

This mirrors how the `data_sync` capability isolates apps in S3
(`config/{envSlug}/{appSlug}/`), and it means two apps built from this template
and pointed at the same SFTP host cannot overwrite each other's files.

**The difference matters.** `data_sync`'s isolation is enforced by IAM: a bug in
the app cannot cross the prefix, because AWS refuses the call. SFTP has no
equivalent. The service account can reach whatever the remote server granted it,
so the confinement here is enforced **by this module's code alone**. It is
defense in depth. It is not a boundary.

> **If you are setting this up:** ask whoever operates the SFTP host to chroot
> the service account to the app's directory. That is the real boundary. The
> code-level confinement protects you from your own bugs; the chroot protects
> you from a bug in this module.

Concretely, the confinement means:

- **Paths in this module's API are app-relative.** `/` is your app's SFTP area,
  never the remote filesystem root. `listSFTPDirectory('/etc/passwd')` reads
  `{root}/etc/passwd` — a file inside your area that almost certainly does not
  exist — rather than `/etc/passwd`.
- **Traversal is rejected, not clamped.** `../` past the root throws
  `SftpPathError` rather than silently resolving somewhere else, so attempts
  show up as errors instead of succeeding quietly.
- **There is one resolver.** `lib/paths.ts` is the only place a remote path is
  produced. `lib/client.ts` is the only module that talks to `ssh2-sftp-client`,
  and it resolves every path itself, so there is no way to reach the server with
  an unconfined path.

If a counterparty dictates a layout that cannot accommodate a per-app
subdirectory, `SFTP_DISABLE_APP_PREFIX=true` drops it. Confinement to
`SFTP_ROOT_PATH` still applies, but you have given up cross-app isolation and
are relying entirely on the server-side chroot. Do it deliberately.

## Authentication

Password or private key, from env. One endpoint per app — there is no
multi-endpoint config, by design.

The host key is pinned. `SFTP_HOST_FINGERPRINT` is **required**: without it the
client accepts any host key, which lets anyone on the network path impersonate
the server and capture the service account credential. Get it with:

```bash
ssh-keyscan -t ed25519 sftp.example.com | ssh-keygen -lf -
```

`SFTP_ALLOW_UNKNOWN_HOST_KEY=true` skips the pin for local development against a
throwaway server. It is refused outright when `NODE_ENV=production`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SFTP_HOST` | Yes | Remote host |
| `SFTP_PORT` | No | Default `22` |
| `SFTP_USERNAME` | Yes | Service account |
| `SFTP_PASSWORD` | One of | Password auth |
| `SFTP_PRIVATE_KEY` | One of | Key auth (PEM contents) |
| `SFTP_PASSPHRASE` | No | Private key passphrase |
| `SFTP_ROOT_PATH` | No | Base directory; app subdirectory is appended. Default `/` |
| `SFTP_HOST_FINGERPRINT` | Yes | Pinned `SHA256:...` host key |
| `SFTP_ALLOW_UNKNOWN_HOST_KEY` | No | Dev only; refused in production |
| `SFTP_MAX_FILE_BYTES` | No | Per-transfer cap, default 25MB |
| `SFTP_DISABLE_APP_PREFIX` | No | Drop the per-app directory. See above |

## Database Schema Changes

None. This capability adds no Prisma models and needs no migration.

## Module API

### Server actions (admin UI)

Every action is gated at **editor-level admin** and returns an
`SFTPOperationResult<T>` envelope — they do not throw for expected failures.

```typescript
import {
  listSFTPDirectory,
  downloadSFTPFile,
  uploadSFTPFile,
  checkSFTPConnection,
  getSFTPAreaInfo,
  getSFTPPolicy,
} from '@/modules/sftp';

const result = await listSFTPDirectory('/inbound');
if (result.success && result.data) {
  console.log(result.data.items);
} else {
  console.error(result.error);
}
```

> **Every export of `lib/actions.ts` is a public POST endpoint.** `'use server'`
> generates a callable action id per exported function, whether or not any
> component references it and whether or not `index.ts` re-exports it.
> Middleware does not cover server actions. If you add a function there, it
> starts with the auth guard — no exceptions. If it should not be callable from
> a browser, it belongs in `lib/client.ts` instead.

### Server-side use (jobs, API routes, importers)

For app code that moves files itself, import from `@/modules/sftp/server`. These
are not server actions: not browser-reachable, and they carry **no auth gate of
their own** — the caller owns that decision.

```typescript
import { downloadFile, uploadFile, withSFTP } from '@/modules/sftp/server';

const buffer = await downloadFile('/inbound/orders-2026-08-22.csv');
await uploadFile(Buffer.from(csv), '/outbound', 'export.csv');

// Multiple operations over one connection:
await withSFTP(async (client) => { /* ... */ });
```

### Transfer policy

`lib/policy.ts` is a pluggable seam, same convention as
`src/modules/auth/server/customer-eligibility.ts`. The default allows reads,
allows writes, caps transfers at `SFTP_MAX_FILE_BYTES`, and restricts uploads to
data-interchange formats (`csv`, `tsv`, `json`, `xlsx`, `parquet`, `gz`, `zip`,
…). Limits are enforced **server-side** in `uploadSFTPFile`.

To change them, replace the exported policy:

```typescript
// src/modules/sftp/lib/policy.ts
export const sftpPolicy: SftpPolicy = {
  ...defaultSftpPolicy,
  allowWrites: false,            // read-only integration
  allowedUploadExtensions: ['csv'],
};
```

The `UploadConfig` prop on `<SFTPFileUpload />` is cosmetic — it shapes the file
picker only. The policy is what actually holds.

### Components

`<SFTPBrowser />` and `<SFTPFileUpload />` render an admin browser over the
app's SFTP area. There is no route in the template; add one (e.g.
`src/app/admin/sftp/page.tsx`) if you want it — `/admin/sftp` is already mapped
to `editor` in `src/modules/auth/utils/access-control.ts`.

## Example Use Cases

- Pull a nightly product feed a customer drops on a Mapp-operated SFTP host.
- Publish an export for a partner who cannot consume an API.
- Give internal admins visibility into what has landed in the app's inbound
  directory, without giving them shell access to the host.

## Anti-patterns

- **Do not expose SFTP to customers by relaxing the auth guard.** The service
  account's read scope is the app's, not the customer's; any caller who reaches
  an ungated action inherits all of it. If customers need files, look them up by
  a reference you scope to their company and have the server resolve the path.
- **Do not accept a path from a client and pass it through.** Client input is an
  app-relative path at most. The resolver is not optional.
- **Do not use this as a database.** No listing index, no transactions, no
  atomic rename guarantees across servers.

## Reference

- `src/modules/sftp/lib/paths.ts` — the confinement resolver and its tests
- `infra/lib/constructs/data-sync-integration.ts` — the IAM-enforced analogue
- MIGRATION.md, 2026-08-22 — the rewrite and what it replaced
