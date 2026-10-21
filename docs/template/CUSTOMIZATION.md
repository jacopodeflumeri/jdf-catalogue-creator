# Customizing the Template

This guide covers common customization points when building a new app from the template.

## Navigation

The navigation system is in `src/modules/navigation/`. It supports both admin and customer sidebars with hierarchical items, conditional visibility, and icons.

### Key Files

| File | Purpose |
|------|---------|
| `src/modules/navigation/config/navigation-items.tsx` | Navigation item definitions and factory functions |
| `src/modules/navigation/types/index.ts` | `NavigationItem` type definition |
| `src/modules/navigation/utils/navigation-filters.ts` | Conditional filtering logic |
| `src/modules/navigation/components/Sidebar.tsx` | Sidebar component (desktop/mobile) |
| `src/modules/navigation/components/Navigation.tsx` | Header navigation component |

### Adding a New Navigation Section

Edit `src/modules/navigation/config/navigation-items.tsx` and add items to `ADMIN_NAVIGATION_ITEMS` (admin sidebar) or `CUSTOMER_NAVIGATION_ITEMS` (customer sidebar):

```typescript
export const ADMIN_NAVIGATION_ITEMS: NavigationItem[] = [
  // Existing items...
  {
    name: 'My Section',
    icon: 'star',
    children: [
      { name: 'Sub Item 1', href: '/admin/my-section/item1', icon: 'file' },
      { name: 'Sub Item 2', href: '/admin/my-section/item2', icon: 'settings' },
    ],
  },
];
```

### Active State

Every nav surface decides "is this link the current page?" with `isNavItemActive(href, pathname)` in `navigation-filters.ts`: it compares paths only (an href may carry `?query` or `#hash`), matches whole segments (`/admin/user` is not active on `/admin/users`), and matches the area roots `/admin` and `/account` exactly. Use it rather than `pathname.startsWith(...)` in any new nav component.

### Navigation Item Options

```typescript
interface NavigationItem {
  name: string;           // Display text
  href?: string;          // Link URL (omit for parent-only dropdowns)
  icon?: string;          // Icon identifier (e.g., 'home', 'users', 'star', 'settings')
  noLink?: boolean;       // Prevents clickability for parent items
  noChildren?: boolean;   // Forces standalone link even if children exist
  badge?: string | number; // Optional badge
  children?: NavigationItem[]; // Nested items
  conditions?: {          // Conditional visibility
    superadmin?: boolean;    // Only show for super admins
    features?: string[];     // Require enabled features
    verticals?: string[];    // Match account vertical
    statuses?: string[];     // Match account status
  };
}
```

### Conditional Visibility

Items with `conditions` are automatically filtered. No manual `if` statements needed — the filtering happens in `filterSidebarItems()` and `filterNavigationItems()`:

```typescript
{
  name: 'Admin Tools',
  href: '/admin/tools',
  icon: 'settings',
  conditions: { superadmin: true }, // Only visible to super admins
}
```

### Bottom Utility Group (Settings)

Items in `ADMIN_UTILITY_NAVIGATION_ITEMS` are pinned to the bottom of the admin sidebar — above the impersonation banner and user card, separated from the main items by a divider — in the expanded, collapsed and mobile sidebars. The template ships only **Settings** there: it is the hub for the standard admin pages (Mapp Team, Company Users, Audit Log), which are cards on `/admin/settings` rather than sidebar entries. Keep feature navigation in `ADMIN_NAVIGATION_ITEMS`; put only app-wide utilities here, and add new standard admin pages as Settings cards.

### Super Admin Section

Items in `ADMIN_NAVIGATION_ADMIN_ITEMS` appear in a separate section near the bottom of the sidebar (above the utility group), below a divider, only for admin-level users. It ships **empty** (the section is hidden while empty): the standard admin pages — Mapp Team, Company Users, Audit Log — are cards on the Settings page instead. Prefer a Settings card for a new admin page; use this list only for something admins need one click away.

### Example: Hackathon Manager Customization

The hackathon-manager project replaced the default admin navigation with domain-specific sections:

```typescript
// Default template:
[
  { name: 'Dashboard', href: '/admin', icon: 'home' },
  { name: 'Accounts', href: '/admin/accounts', icon: 'users' },
]

// Hackathon customization:
[
  { name: 'Events', href: '/events', icon: 'star', noChildren: true },
  {
    name: 'Hackathon Admin',
    icon: 'settings',
    children: [
      { name: 'Events', href: '/admin/hackathon/events', icon: 'file' },
      { name: 'Audit Log', href: '/admin/hackathon/audit', icon: 'eye' },
    ],
  },
]
```

## Role Model & Access Control

The template ships with a back-office admin panel model where `MappTeam` members manage customer `Account` objects. See [PERMISSION-LEVELS.md](./PERMISSION-LEVELS.md) for the full access level system.

### Default Model

- **Customer users** authenticate via Keycloak **Company Login** and are tracked in `CompanyUser` (Magic Link is an optional legacy path, off by default)
- **Admin users** authenticate via Keycloak's **Mapp Entra ID** button and are tracked in `MappTeam`
- The first Mapp user ever to log in becomes `admin`; every later login gets `accessLevel: 'viewer'` and `accessStatus: 'active'`. There is no pending or approval step

### Extending for App-Specific Roles

If your app needs a different role model (e.g., all Mapp employees are users, not just admins), consider these approaches:

**Option A: Use the customer portal for all users.** Keep the admin dashboard for actual admins, and build the main app experience in the customer portal routes (`/account/*`). The Mapp Entra ID login can be used for customer auth too — see `src/modules/auth/config/nextauth.ts`.

**Option B: Add custom roles.** Extend the `MappTeam.accessLevel` enum in the Prisma schema and update the permission checks in `src/modules/auth/utils/access-control.ts`. The `requireAdmin()` guard and `useAccessLevel()` hook support custom access levels.

**Option C: Bypass the MappTeam model entirely.** For apps where every authenticated user has the same role, you can ignore access levels. All Mapp logins are immediately active as viewers.

### Key Files for Access Control

| File | Purpose |
|------|---------|
| `src/modules/auth/utils/access-control.ts` | Permission matrix and helpers |
| `src/modules/auth/server/require-auth.ts` | Server-side guards (`requireAdmin()`, `requireCustomer()`) |
| `src/modules/auth/client/hooks/useAccessLevel.ts` | Client-side permission hook |
| `src/modules/auth/config/nextauth.ts` | Auth providers and session callbacks |
| `prisma/schema.prisma` | `MappTeam` model with `accessLevel` and `accessStatus` |

## Session Management

NextAuth handles all session management automatically. No additional session store (e.g., `connect-pg-simple`) is needed. Sessions are stored as JWTs in the session cookie, which holds scalar identifiers only. Claims whose size depends on the user's profile (`roles`, `workspaces`, `mappLdapGroups`) and the Keycloak `id_token` are kept server-side in the `auth_session` table and read back onto `session.user` — see `src/modules/auth/server/auth-session.ts`. If you add a claim that is a list, store it there, not on the JWT.

## Static Pages and Client Context

Pages that use client-side React context (e.g., cookie consent) cannot be statically generated at build time. If you get errors like `TypeError: Cannot destructure property ... as it is undefined` during `next build`, add this to the page:

```typescript
export const dynamic = 'force-dynamic';
```

This forces server-side rendering instead of static generation for that page.

## Optional: Cross-environment config sync

If your app has admin-editable config (taxonomy, rules, settings) and you want to refresh staging from prod for realistic testing, enable the **Data Sync** capability. It wires the ECS task role into the shared `mapp-labs-data-sync` S3 bucket and ships script skeletons for dump/restore.

- Guide (enable steps, IAM model, operational workflows): [`docs/template/capabilities/DATA_SYNC.md`](capabilities/DATA_SYNC.md)

It's purpose-built for prod→staging refreshes; not a general-purpose S3 capability.
