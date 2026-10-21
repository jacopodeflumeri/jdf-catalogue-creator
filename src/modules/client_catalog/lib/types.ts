/**
 * Client Catalog Types
 *
 * Types matching the Company Management Service (GUM) API V2.
 * See swagger: http://company-management-service.k8s-int-01.nbg.webtrekk.com/gum-service/api/swagger-ui/index.html
 *
 * Companies map to Accounts. Workspaces belong to companies and
 * can serve multiple Mapp products via the services array.
 */

import type { InternalApiOAuthConfig } from "@/lib/internal-api/oauth";

// ---------------------------------------------------------------------------
// Company types
// ---------------------------------------------------------------------------

/**
 * Full company detail — returned by GET /v2/companies/{companyId}.
 * Matches CompanyResponseDto in the API.
 */
export type Company = {
  id: number;
  name: string;
  active: boolean;
  description?: string;
  loginPrefix?: string;
  salesforceId?: string;
  businessAttributes?: Record<string, string>;
  workspaces?: WorkspaceResponse[];
  initialSubject?: InitialSubject;
};

/**
 * Lightweight company overview — returned by GET /v2/companies (list).
 * Matches CompanyOverviewResponseDto in the API.
 */
export type CompanyOverview = {
  id: number;
  name: string;
  description?: string;
  salesforceId?: string;
  createdAt?: string;
  active: boolean;
  linkedWorkspaceNames?: string[];
};

/**
 * Initial subject (admin user) linked to a company.
 * Matches InitialSubjectOverviewDto in the API.
 */
export type InitialSubject = {
  email?: string;
  lastName?: string;
  firstName?: string;
  loginName?: string;
};

// ---------------------------------------------------------------------------
// Workspace types
// ---------------------------------------------------------------------------

/**
 * Full workspace response — returned by GET /workspaces/{id}
 * and nested inside CompanyResponseDto.
 * Matches WorkspaceResponseDto in the API.
 */
export type WorkspaceResponse = {
  id: number;
  companyId: number;
  tenantId?: string;
  name?: string;
  description?: string;
  accountId?: string;
  accountName?: string;
  systemId?: string;
  dashboardSystemId?: string;
  systemName?: string;
  fashionNamespaceId?: string;
  fashionSlugName?: string;
  fashionRegion?: string;
  createdAt?: string;
  services?: string[];
};

/**
 * Internal workspace API response — returned by GET /internal/workspaces.
 * Matches WorkspaceApiResponseDto in the API.
 * Contains product-specific instance IDs useful for cross-referencing.
 */
export type WorkspaceApiResponse = {
  workspaceId: number;
  companyId: number;
  intelligenceInstanceId?: number;
  engageInstanceId?: number;
  dashboardEngageInstanceId?: number;
  workspaceName?: string;
  intelligenceInstanceName?: string;
  engageInstanceName?: string;
  fashionInstanceId?: string;
  fashionInstanceName?: string;
};

/**
 * Fashion-specific workspace — returned by GET /fashion/workspaces.
 * Matches FashionWorkspaceResponseDto in the API.
 */
export type FashionWorkspaceResponse = {
  id: number;
  companyId: number;
  fashionNamespaceId?: string;
  fashionSlugName?: string;
  fashionRegion?: string;
};

/**
 * Fashion-specific company — returned by GET /fashion/companies.
 * Matches FashionCompanyResponseDto in the API.
 */
export type FashionCompanyResponse = {
  id: number;
  name: string;
  defaultColocation?: string;
  fashionUniqueId?: string;
  prefix?: string;
  active: boolean;
  workspaces?: FashionWorkspaceResponse[];
};

/**
 * Selectable services for a workspace.
 * Matches SelectableServicesResponseDto in the API.
 * Service values: "INTELLIGENCE", "ST", "ENGAGE", "FASHION"
 */
export type SelectableServices = {
  workspaceId: number;
  workspaceName?: string;
  services?: string[];
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export type ClientCatalogConfig = {
  baseUrl: string;
  /** Shared internal-API OAuth2 credential (realm s2s). See src/lib/internal-api/oauth.ts */
  oauth?: InternalApiOAuthConfig;
  /** Basic Auth fallback (QA only) */
  basicUsername?: string;
  basicPassword?: string;
};
