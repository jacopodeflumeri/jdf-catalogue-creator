/** @jest-environment node */

/**
 * Tests for Client Catalog discovery
 *
 * Verifies:
 * 1. discoverCompanies returns companies with their workspaces
 * 2. Filtering by active status
 * 3. Filtering by company ID (direct fetch, no list call)
 * 4. Empty results handling
 * 5. Skips companies that return null from getCompany
 */

jest.mock("@/lib/utils/logger", () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("../client", () => ({
  listCompanies: jest.fn(),
  getCompany: jest.fn(),
  getWorkspaces: jest.fn(),
}));

import { discoverCompanies } from "../discovery";
import { listCompanies, getCompany, getWorkspaces } from "../client";

const mockListCompanies = listCompanies as jest.MockedFunction<typeof listCompanies>;
const mockGetCompany = getCompany as jest.MockedFunction<typeof getCompany>;
const mockGetWorkspaces = getWorkspaces as jest.MockedFunction<typeof getWorkspaces>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("discoverCompanies", () => {
  const companyOverviews = [
    { id: 1, name: "Acme", active: true },
    { id: 2, name: "Globex", active: true },
  ];

  const companyDetail1 = {
    id: 1,
    name: "Acme",
    active: true,
    salesforceId: "SF001",
  };

  const companyDetail2 = {
    id: 2,
    name: "Globex",
    active: true,
    salesforceId: "SF002",
  };

  const workspaces1 = [
    { id: 10, companyId: 1, name: "Acme Analytics", services: ["INTELLIGENCE"] },
  ];

  const workspaces2 = [
    { id: 20, companyId: 2, name: "Globex Fashion", services: ["FASHION"], fashionSlugName: "globex" },
    { id: 21, companyId: 2, name: "Globex Engage", services: ["ENGAGE"] },
  ];

  it("returns all companies with their workspaces", async () => {
    mockListCompanies.mockResolvedValue(companyOverviews);
    mockGetCompany.mockResolvedValueOnce(companyDetail1).mockResolvedValueOnce(companyDetail2);
    mockGetWorkspaces.mockResolvedValueOnce(workspaces1).mockResolvedValueOnce(workspaces2);

    const result = await discoverCompanies();

    expect(result).toHaveLength(2);
    expect(result[0].company.name).toBe("Acme");
    expect(result[0].company.salesforceId).toBe("SF001");
    expect(result[0].workspaces).toEqual(workspaces1);
    expect(result[1].company.name).toBe("Globex");
    expect(result[1].workspaces).toEqual(workspaces2);
  });

  it("passes active filter to listCompanies", async () => {
    mockListCompanies.mockResolvedValue([]);

    await discoverCompanies({ active: true });

    expect(mockListCompanies).toHaveBeenCalledWith({ active: true }, undefined);
  });

  it("fetches company directly by ID without calling listCompanies", async () => {
    mockGetCompany.mockResolvedValue(companyDetail2);
    mockGetWorkspaces.mockResolvedValue(workspaces2);

    const result = await discoverCompanies({ companyId: 2 });

    expect(result).toHaveLength(1);
    expect(result[0].company.id).toBe(2);
    expect(mockListCompanies).not.toHaveBeenCalled();
    expect(mockGetCompany).toHaveBeenCalledWith(2, undefined);
    expect(mockGetWorkspaces).toHaveBeenCalledWith(2, undefined);
  });

  it("returns empty array when no companies found", async () => {
    mockListCompanies.mockResolvedValue([]);

    const result = await discoverCompanies();

    expect(result).toEqual([]);
    expect(mockGetCompany).not.toHaveBeenCalled();
    expect(mockGetWorkspaces).not.toHaveBeenCalled();
  });

  it("skips companies where getCompany returns null", async () => {
    mockListCompanies.mockResolvedValue(companyOverviews);
    mockGetCompany.mockResolvedValueOnce(companyDetail1).mockResolvedValueOnce(null);
    mockGetWorkspaces.mockResolvedValue(workspaces1);

    const result = await discoverCompanies();

    expect(result).toHaveLength(1);
    expect(result[0].company.name).toBe("Acme");
    expect(mockGetWorkspaces).toHaveBeenCalledTimes(1);
  });

  it("returns empty workspaces array when company has no workspaces", async () => {
    mockListCompanies.mockResolvedValue([companyOverviews[0]]);
    mockGetCompany.mockResolvedValue(companyDetail1);
    mockGetWorkspaces.mockResolvedValue([]);

    const result = await discoverCompanies();

    expect(result).toHaveLength(1);
    expect(result[0].workspaces).toEqual([]);
  });
});
