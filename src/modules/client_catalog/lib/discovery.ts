/**
 * Client Catalog Discovery
 *
 * Fetches companies and their workspaces from the Company Management Service.
 * Returns pure data — the consuming app decides what to do with it (DB writes, etc.).
 */

import { listCompanies, getCompany, getWorkspaces } from "./client";
import type {
  Company,
  CompanyOverview,
  WorkspaceResponse,
  ClientCatalogConfig,
} from "./types";

export type DiscoveredCompany = {
  company: Company;
  workspaces: WorkspaceResponse[];
};

/**
 * Discover companies and their workspaces from the Client Catalog.
 *
 * Fetches the company list (overview), then for each company fetches
 * full detail and workspaces. If companyId is provided, only that
 * company is fetched directly.
 *
 * @param options.active - If set, only return companies with this active status
 * @param options.companyId - If set, only discover this specific company
 * @param config - Override env-based config
 * @returns Array of companies with their workspaces
 */
export async function discoverCompanies(
  options?: { active?: boolean; companyId?: number },
  config?: ClientCatalogConfig,
): Promise<DiscoveredCompany[]> {
  let companyIds: number[];

  if (options?.companyId) {
    companyIds = [options.companyId];
  } else {
    const overviews: CompanyOverview[] = await listCompanies(
      { active: options?.active },
      config,
    );
    companyIds = overviews.map((c) => c.id);
  }

  const results: DiscoveredCompany[] = [];

  for (const id of companyIds) {
    const company = await getCompany(id, config);
    if (!company) continue;

    const workspaces = await getWorkspaces(id, config);
    results.push({ company, workspaces });
  }

  return results;
}
