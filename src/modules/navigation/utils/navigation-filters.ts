/**
 * Navigation Filter Functions
 * 
 * Unified filtering functions for all navigation menu types.
 * Supports NavigationItem.
 */

import type { NavigationItem } from '../types';

/**
 * Generic conditions checker - works with all menu item types
 * @param conditions - Conditions object to check
 * @param account - Account data for validation
 * @param isSuperAdmin - Whether current user is a super admin
 * @param hasContentPages - Whether content pages exist (optional)
 * @returns True if conditions are met
 */
function checkConditions(
  conditions: {
    features?: string[];
    verticals?: string[];
    statuses?: string[];
    stages?: string[];
    superadmin?: boolean;
    contentPages?: boolean;
  } | undefined,
  account?: any | null,
  isSuperAdmin?: boolean,
  hasContentPages?: boolean
): boolean {
  // No conditions = always show
  if (!conditions) return true;
  
  // Superadmin bypass - show everything
  if (conditions.superadmin && isSuperAdmin) return true;
  
  // Check features
  if (conditions.features && conditions.features.length > 0) {
    const hasFeature = conditions.features.some(feature => {
      const featureKey = `${feature}Enabled`;
      return account?.enabledFeatures?.[featureKey] === true;
    });
    if (!hasFeature) return false;
  }
  
  // Check content pages
  if (conditions.contentPages !== undefined) {
    if (conditions.contentPages === true && !hasContentPages) return false;
    if (conditions.contentPages === false && hasContentPages) return false;
  }
  
  // Check verticals
  if (conditions.verticals && conditions.verticals.length > 0) {
    if (!account?.vertical || !conditions.verticals.includes(account.vertical)) {
      return false;
    }
  }
  
  // Check statuses
  if (conditions.statuses && conditions.statuses.length > 0) {
    if (!account?.status || !conditions.statuses.includes(account.status)) {
      return false;
    }
  }
  
  // Check stages
  if (conditions.stages && conditions.stages.length > 0) {
    if (!account?.stage || !conditions.stages.includes(account.stage)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Area roots. A link to one of these is active only on that exact page —
 * otherwise "Dashboard" (`/admin`) would light up on every admin page.
 */
const EXACT_MATCH_HREFS = new Set(["/", "/admin", "/account"]);

/**
 * The path part of a nav href: no `?query`, no `#hash`, no trailing slash.
 */
export function navHrefPath(href: string): string {
  const path = href.split(/[?#]/, 1)[0] ?? "";
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/**
 * Whether a nav link points at the current page (or a page below it).
 *
 * The single rule every nav surface uses — sidebar, top nav, sub-items:
 * - compares paths only, so an href carrying `?query` or `#hash` still matches
 *   its page;
 * - matches on whole path segments, so `/admin/user` is NOT active on
 *   `/admin/users`, but `/admin/users` is active on `/admin/users/42`;
 * - area roots (`/admin`, `/account`, `/`) match exactly.
 *
 * @param href - The nav item's href (may be undefined for parent-only items)
 * @param pathname - Current pathname from `usePathname()`
 */
export function isNavItemActive(
  href: string | undefined | null,
  pathname: string | null | undefined,
): boolean {
  if (!href || !pathname) return false;
  const target = navHrefPath(href);
  if (!target) return false;
  const current = navHrefPath(pathname);
  if (EXACT_MATCH_HREFS.has(target)) return current === target;
  return current === target || current.startsWith(`${target}/`);
}

/**
 * Check if any of a navigation item's children is active
 * @param item - Navigation item to check
 * @param pathname - Current pathname
 * @returns True if any child is active
 */
export function isParentActive(item: NavigationItem, pathname: string): boolean {
  return item.children?.some((child: NavigationItem) => isNavItemActive(child.href, pathname)) || false;
}

/**
 * Check if a specific href is active (see `isNavItemActive`)
 * @param href - Href to check
 * @param pathname - Current pathname
 * @returns True if href is active
 */
export function isActive(href: string, pathname: string): boolean {
  return isNavItemActive(href, pathname);
}

/**
 * Get CSS classes for parent navigation items based on active state
 * @param item - Navigation item
 * @param pathname - Current pathname
 * @param activeDropdown - Currently active dropdown name
 * @returns CSS class string
 */
export function getParentActiveClasses(
  item: NavigationItem,
  pathname: string,
  activeDropdown: string | null
): string {
  const isItemActive = (item.href && isActive(item.href, pathname)) || isParentActive(item, pathname);

  // Glass design tokens (docs/template/DESIGN-SYSTEM.md "Navigation"): the active item
  // is a floating white pane with purple text, the open dropdown a frosted
  // pill, the rest muted charcoal with a subtle white wash on hover.
  if (isItemActive) {
    return 'bg-[rgba(255,255,255,0.52)] border border-white/80 text-primary shadow-[0_2px_10px_rgba(141,119,247,0.12)]';
  } else if (activeDropdown === item.name) {
    return 'bg-white/35 border border-white/70 text-[#1a1a1a]/80';
  } else {
    return 'border border-transparent text-[#1a1a1a]/65 hover:bg-white/35 hover:text-[#1a1a1a] hover:border-white/70';
  }
}

/**
 * Filter header navigation items (for top nav dropdowns)
 * Removes items where conditions are not met and filters children
 * 
 * @param items - Header navigation items to filter
 * @param account - Customer account data for condition checking
 * @param isSuperAdmin - Whether current user is a super admin
 * @returns Filtered header navigation items
 */
export function filterNavigationItems(
  items: NavigationItem[],
  account?: any | null,
  isSuperAdmin?: boolean
): NavigationItem[] {
  return items.map(item => ({
    ...item,
    children: item.children?.filter((child: NavigationItem) => 
      checkConditions(child.conditions, account, isSuperAdmin)
    ) || []
  })).filter(item => item.noChildren || (item.children && item.children.length > 0));
}

/**
 * Filter sidebar navigation items (for customer/admin sidebars)
 * Removes items where conditions are not met and filters children recursively
 * 
 * @param items - Sidebar navigation items to filter
 * @param account - Customer account data for condition checking
 * @param isSuperAdmin - Whether current user is a super admin
 * @param hasContentPages - Whether content pages exist
 * @returns Filtered sidebar navigation items
 */
export function filterSidebarItems(
  items: NavigationItem[],
  account?: any | null,
  isSuperAdmin?: boolean,
  hasContentPages?: boolean
): NavigationItem[] {
  return items
    .filter(item => checkConditions(item.conditions, account, isSuperAdmin, hasContentPages))
    .map(item => {
      if (item.children) {
        return {
          ...item,
          children: filterSidebarItems(item.children, account, isSuperAdmin, hasContentPages)
        };
      }
      return item;
    });
}
