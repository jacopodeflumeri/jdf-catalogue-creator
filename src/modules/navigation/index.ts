/**
 * Navigation Module - Public API
 *
 * This module provides a complete, portable navigation system that can be used across projects.
 * The module exports:
 * - Components: NavigationComponent / NavigationWrapper (header nav), Sidebar (side nav), SearchBar
 * - Types: All navigation-related TypeScript interfaces
 * - Utilities: Helper functions for navigation logic and filtering
 * - Configuration: Navigation items, logo config, and routing logic
 *
 * Unified Navigation Usage (works for both header and sidebar):
 * ```typescript
 * import { NavigationComponent, Sidebar, createNavigationItems, filterSidebarItems } from '@/modules/navigation';
 *
 * // Create navigation items once
 * const navItems = createNavigationItems('customer', customerAccount, contentPages);
 *
 * // Use in header navigation
 * <NavigationComponent
 *   navigationItems={navItems}
 *   customerAccount={customerAccount}
 * />
 *
 * // Use in sidebar navigation (with filtering)
 * const filtered = filterSidebarItems(navItems, customerAccount, false, hasContentPages);
 * <Sidebar
 *   variant="desktop"
 *   navigationItems={filtered}
 *   userType="customer"
 *   dashboardRoute="/account"
 * />
 * ```
 *
 * Layouts: prefer `NavigationComponent` over `NavigationWrapper`.
 * `NavigationWrapper` (also the default export) renders NOTHING until it has
 * mounted on the client, so in a server-rendered layout the top bar pops in
 * after hydration and pushes the page down (a visible layout shift on every
 * page). Its only other job is reading `?simple=true` into `isSimpleMode`; a
 * layout that wants that reads `useSearchParams()` itself and passes
 * `isSimpleMode` to `NavigationComponent` (see CustomerLayoutClient). Keep the
 * wrapper only where a client-only render is genuinely wanted.
 *
 * Note: Both LOGO_CONFIG and getLogoHref are handled internally by the Navigation component.
 * To customize them, edit the config file at /modules/navigation/config/navigation-items.tsx
 */

// Components
export { default as NavigationWrapper } from "./components/NavigationWrapper";
export { default as NavigationComponent } from "./components/Navigation";
export { default as Sidebar } from "./components/Sidebar";
export { default as SearchBar } from "./components/SearchBar";
export { default as EnvironmentLabsPill } from "./components/EnvironmentLabsPill";

// Types
export type {
  NavigationProps,
  NavigationComponentProps,
  LogoConfig,
  NavigationUserProfile,
  NavigationItem,
} from "./types";

// Utilities
export {
  getInitials,
  getUserInitials,
  getUserDisplayName,
  getDefaultLogoHref,
} from "./utils/navigation-helpers";

export {
  isNavItemActive,
  navHrefPath,
  isParentActive,
  isActive,
  getParentActiveClasses,
  filterNavigationItems,
  filterSidebarItems,
} from "./utils/navigation-filters";

// Configuration (re-exported for convenience)
export {
  ADMIN_NAVIGATION_ITEMS,
  ADMIN_NAVIGATION_ADMIN_ITEMS,
  ADMIN_UTILITY_NAVIGATION_ITEMS,
  LOGO_CONFIG,
  LOGO_ALT_CONFIG,
  getLogoHref,
  createCustomerNavigationItems,
  createNavigationItems,
} from "./config/navigation-items";

// Default export is the wrapper component
export { default } from "./components/NavigationWrapper";
