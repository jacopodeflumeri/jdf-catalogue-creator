# Permission Levels

The admin panel enforces three access levels for Mapp team members. All levels can view everything; permissions control what can be modified.

## Access Levels

| DB Value | Display Name | Description |
|----------|-------------|-------------|
| `viewer` | **Viewer** | Read-only. Default for all new logins. |
| `editor` | **Editor** | Can modify accounts, manage users, and perform data operations. Cannot manage team access. |
| `admin` | **Admin** | Full access including team member access level management. |

SuperAdmins (set via `SUPER_ADMINS` env var or the `isSuperAdmin` DB flag) bypass all access level restrictions.

## How Access Level Is Determined

1. The `MappTeam.accessLevel` column stores the value (`viewer`, `editor`, or `admin`), defaulting to `viewer`.
2. On every page load, the JWT callback in `src/modules/auth/config/nextauth.ts` reads the latest `accessLevel` from the database and stores it in `token.access`.
3. The session callback copies `token.access` to `session.user.access`.
4. Changes to `accessLevel` take effect on the user's next page navigation (no re-login required).

## Server-Side Enforcement

### `requireAdmin()` Options

| Option | Who Can Access | Use Case |
|--------|---------------|----------|
| `requireAdmin()` | Any active admin (viewer, editor, admin) | Read/list/get operations |
| `requireAdmin({ requireEditorAccess: true })` | Editor or admin (not viewer) | Mutations: create, update, delete |
| `requireAdmin({ requireAdminAccess: true })` | Admin only (not viewer or editor) | Team management operations |
| `requireAdmin({ requireSuperAdmin: true })` | SuperAdmin only | System-level operations |

### Server Action Guard Pattern

```typescript
// Read operation — all levels
export async function listItems() {
  await requireAdmin();
  // ...
}

// Mutation — editor+ only
export async function createItem(data: CreateItemInput) {
  await requireAdmin({ requireEditorAccess: true });
  // ...
}

// Team management — admin only
export async function updateEmployeeAccess(data: UpdateAccessInput) {
  await requireAdmin({ requireAdminAccess: true });
  // ...
}
```

### View as Customer (admin only)

When the optional `customer_preview` capability is enabled, **Admin** level
users and SuperAdmins can open a company's customer pages (`/account/*`)
exactly as its Company-Login customers see them — the **View as customer**
button on `/admin/company-users` (and on the client_catalog scaffold's company
page). Viewers and Editors do not see the button, and
`startCustomerPreviewAction` enforces `requireAdmin({ requireAdminAccess: true })`.

The preview is read-only (customer mutations refuse it), lasts 30 minutes, is
bound to the admin who started it, stops working as soon as that admin loses
admin access (level, suspension, IP allow-list), and writes
`customer_preview_start` / `customer_preview_end` rows to the audit log (entity
type `company`). Details: [capabilities/CUSTOMER_PREVIEW.md](capabilities/CUSTOMER_PREVIEW.md).

## Client-Side UI

### `useAccessLevel()` Hook

For client components within the admin layout:

```typescript
import { useAccessLevel } from "@/modules/auth/client";

function MyComponent() {
  const { accessLevel, isSuperAdmin, canEdit, isAdmin } = useAccessLevel();

  return (
    <div>
      {canEdit && <Button onClick={handleCreate}>Create</Button>}
    </div>
  );
}
```

### Server Component Pattern

For server components, compute permissions from the session:

```typescript
export default async function MyPage() {
  const session = await requireAdmin();
  const canEdit = session.user.isSuperAdmin ||
    ["editor", "admin"].includes((session.user as any).access || "viewer");

  return <MyClient canEdit={canEdit} />;
}
```

### UI Strategy

- Mutation buttons (Create, Edit, Delete) are **hidden** for viewers
- Server actions are the real enforcement layer; UI hiding is a courtesy
- Edit pages redirect viewers back to the view page
- Settings page hides "Mapp Team" tile for non-admin users

## Adding Permission Checks to New Features

1. **Server action**: Add `{ requireEditorAccess: true }` to mutations, keep plain `requireAdmin()` for reads
2. **Server component**: Compute `canEdit` from session and pass as prop
3. **Client component**: Use `useAccessLevel()` hook or accept `canEdit` prop
4. **Wrap mutation UI**: `{canEdit && <Button>...</Button>}`

## Files Reference

| File | Purpose |
|------|---------|
| `src/modules/auth/utils/access-control.ts` | Permission matrix, helpers, labels |
| `src/modules/auth/server/require-auth.ts` | Server-side guards (`requireAdmin()`) |
| `src/modules/auth/types/index.ts` | `RequireAdminOptions` type |
| `src/modules/auth/client/hooks/useAccessLevel.ts` | Client-side permission hook |
| `src/modules/auth/config/nextauth.ts` | JWT/session callbacks (populates `access`) |
