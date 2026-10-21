/**
 * Navigation Module - Type Definitions
 * 
 * Portable type definitions for navigation components.
 * These types can be used across different projects.
 */

import type { CustomerAccountData } from '@/types';

/**
 * Props for the main Navigation component
 */
export interface NavigationProps {
  className?: string;
  customerAccount?: CustomerAccountData | null;
  navigationItems?: NavigationItem[];
  isSuperAdmin?: boolean;
  inPage?: boolean;
}

/**
 * Internal props for NavigationComponent (includes isSimpleMode)
 */
export interface NavigationComponentProps extends NavigationProps {
  isSimpleMode?: boolean;
  logoHref?: string;
}

/**
 * Unified navigation item structure
 * Works for both header dropdowns and sidebar navigation
 * 
 * - For header: parent items can have optional href (dropdown triggers)
 * - For sidebar: all items should have href (clickable links)
 * - Icons are string identifiers rendered by components
 * - Children are recursive NavigationItem[] for flexibility
 */
export interface NavigationItem {
  name: string;
  href?: string; // Optional for header dropdown parents, required for sidebar
  noLink?: boolean; // If true, parent item is not clickable (no href)
  icon?: string; // String identifier like 'user', 'dashboard', etc.
  badge?: string | number;
  children?: NavigationItem[];
  noChildren?: boolean; // If true, renders as standalone link even if children exist (ignores dropdown behavior)
  conditions?: {
    features?: string[];
    verticals?: string[];
    statuses?: string[];
    stages?: string[];
    superadmin?: boolean;
    contentPages?: boolean;
  };
}

/**
 * Logo configuration
 */
export interface LogoConfig {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}

/**
 * User profile information (minimal for navigation needs)
 */
export interface NavigationUserProfile {
  firstname: string;
  lastname: string;
  image?: any; // S3Image type
}

// Search types
export interface SearchResult {
  id: string;
  title: string;
  description?: string;
  url: string;
  type: SearchResultType;
  relevance?: number;
  metadata?: Record<string, any>;
  criteria?: boolean;
}

export type SearchResultType = 
  | 'page'
  | 'module'
  | 'account'
  | 'content'
  | 'blog';

export interface SearchResultsByType {
  [key: string]: SearchResult[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  resultsByType: SearchResultsByType;
}
