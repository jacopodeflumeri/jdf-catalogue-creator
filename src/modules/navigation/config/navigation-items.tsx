import { NavigationItem } from '@/types';
import type { LogoConfig } from '@/modules/navigation';
import type { CustomerAccountData } from '@/types';

export const customerSidebar = true;
export const customerTopNav = true;
export const customerTopNavFixed = false;

// ============================================================================
// Admin Sidebar Navigation
// ============================================================================

export const ADMIN_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: 'home'
  },
  {
    name: 'Premium',
    href: '/admin/catalogs/premium-apparel',
    icon: 'fashion'
  },
  {
    name: 'Fast Fashion',
    href: '/admin/catalogs/fast-fashion',
    icon: 'clothes'
  },
  {
    name: 'Luxury',
    href: '/admin/catalogs/luxury-fashion',
    icon: 'dress'
  },
  {
    name: 'Activewear',
    href: '/admin/catalogs/activewear',
    icon: 'lightning'
  },
  {
    name: 'LiteLLM Usage',
    href: '/admin/llm-usage',
    icon: 'chart'
  },
  // The "Companies" entry (and the /admin/companies routes) ship with the
  // client_catalog capability — see src/modules/client_catalog/scaffold/.
  // Add it back here when you install that scaffold:
  //   { name: 'Companies', href: '/admin/companies', icon: 'users' },
];

// Utility entries pinned to the bottom of the admin sidebar (above the
// impersonation banner and user card), separated from the main items above by
// a divider. Shown to every admin.
//
// Settings is the hub for the standard admin pages (Mapp Team, Company Users,
// Audit Log), none of which has a sidebar entry of its own — add new ones as
// cards in src/app/admin/settings/client.tsx rather than as more sidebar
// entries. Keep this group short; it is for app-wide utilities, not features.
export const ADMIN_UTILITY_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    name: 'Settings',
    href: '/admin/settings',
    icon: 'settings'
  },
];

// Extra sidebar entries shown only to admin-level users, in their own section
// below a divider. Empty by default: Mapp Team lives on the Settings page
// (/admin/settings), which hides the card from non-admins itself. The section
// is not rendered while this is empty.
export const ADMIN_NAVIGATION_ADMIN_ITEMS: NavigationItem[] = [];

// ============================================================================
// Header Navigation Configuration
// ============================================================================

/**
 * Logo configuration for the navigation header
 */
export const LOGO_CONFIG: LogoConfig = {
  src: '/img/mapp-primary-logo.svg',
  alt: 'Mapp',
  width: 120,
  height: 32,
};
export const LOGO_ALT_CONFIG: LogoConfig = {
  src: '/img/mapp-alt-logo.svg',
  alt: 'Mapp',
  width: 120,
  height: 32,
};

/**
 * Determines the href for the logo based on current pathname
 * - Admin users (/admin/*) → /admin
 * - Customer users → /account
 */
export function getLogoHref(pathname: string): string {
  return pathname.startsWith('/admin') ? '/admin' : '/account';
}

/**
 * Creates the unified navigation items dynamically based on customer account data and content pages
 * This function generates navigation structure that works for both header dropdowns and sidebar
 * 
 * Note: Icons are string identifiers rendered by components
 */

const CUSTOMER_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/account',
    icon: 'home',
    noChildren: true,  // Renders as regular link
  },
  // {
  //   name: 'Content',
  //   href: '/account/content',
  //   icon: 'file',
  //   children: [
  //     {
  //       name: 'Blog Articles',
  //       href: '/account/content/blog',  
  //       icon: 'file-text'
  //     },
  //     {
  //       name: 'Pages',
  //       href: '/account/content/pages',
  //       icon: 'file'
  //     }
  //   ]
  // }
];


export function createCustomerNavigationItems(
  _customerAccount?: CustomerAccountData | null
): NavigationItem[] {
  // Clone the items array so we don't mutate the original
  const items = [...CUSTOMER_NAVIGATION_ITEMS];
  return items;
}

/**
 * Unified function to create navigation items for both customer and admin users
 * @param userType - Type of user ('customer' or 'admin')
 * @param customerAccount - Customer account data (only used for customer userType)
 * @returns Navigation items array
 */
export function createNavigationItems(
  userType: 'customer' | 'admin',
  customerAccount?: CustomerAccountData | null
): NavigationItem[] {
  if (userType === 'admin') {
    return ADMIN_NAVIGATION_ITEMS;
  }

  return createCustomerNavigationItems(customerAccount);
}
