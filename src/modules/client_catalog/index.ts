/**
 * Client Catalog Module
 *
 * API client for Mapp's Company Management Service.
 * Discover companies and workspaces across Mapp products.
 */

export {
  listCompanies,
  getCompany,
  getWorkspaces,
  getWorkspace,
} from "./lib/client";

// Auth now uses the shared internal-API token provider; expose its cache-clear
// (e.g. for forced refresh in tests) in place of the old per-client one.
export { clearInternalApiTokenCache } from "@/lib/internal-api/oauth";

export type {
  Company,
  CompanyOverview,
  WorkspaceResponse,
  WorkspaceApiResponse,
  FashionWorkspaceResponse,
  FashionCompanyResponse,
  SelectableServices,
  InitialSubject,
  ClientCatalogConfig,
} from "./lib/types";

export {
  discoverCompanies,
  type DiscoveredCompany,
} from "./lib/discovery";
