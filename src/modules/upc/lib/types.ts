/**
 * UPC (Unified Product Catalog) Types
 *
 * Types for the Mapp Product Feed Service API.
 */

import type { InternalApiOAuthConfig } from "@/lib/internal-api/oauth";

export type FeedDataType = "SOURCE" | "ENRICHED" | "COMBINED";

export type ProductFeed = {
  id: number;
  companyId: number;
  name: string;
  description?: string;
  callbackURL?: string;
  enrichReady?: boolean;
  createDate?: string;
  modifyDate?: string;
};

export type ProductAttribute = {
  id: number;
  companyId?: number;
  name: string;
  displayName?: string;
  description?: string;
  dataType: string;
  localizedAttributeKeyType?: string;
  localizedAttributeValueType?: string;
  isMandatory?: boolean;
  isCustom?: boolean;
  isActive?: boolean;
};

export type ProductFeedData = {
  variantId: string;
  productId: string;
  feedId: number;
  data: Record<string, unknown>;
  createdAt?: number;
  updatedAt?: number;
};

export type PaginatedProductFeedData = {
  nextPageExists: boolean;
  lastId: string | null;
  lastSortValue?: unknown;
  productViewPayloads: ProductFeedData[];
};

export type ProductFeedDataCount = {
  companyId: number;
  feedId: number;
  numberOfProducts: number;
};

export type UpcClientConfig = {
  baseUrl: string;
  /** Shared internal-API OAuth2 credential (realm s2s). See src/lib/internal-api/oauth.ts */
  oauth?: InternalApiOAuthConfig;
};

export type FeedWorkspaceMapping = {
  companyId: number;
  workspaceId: number;
  workspaceName: string;
  intelligenceInstanceId?: number | null;
  intelligenceInstanceName?: string | null;
  engageInstanceId?: number | null;
  engageInstanceName?: string | null;
  fashionInstanceId?: string | null;
  fashionInstanceName?: string | null;
};
