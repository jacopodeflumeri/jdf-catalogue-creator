/**
 * @jest-environment node
 */

/**
 * Search escaping — Database Tests (against real PostgreSQL).
 * Prisma's `contains` passes `%` and `_` through as LIKE wildcards; the search
 * services escape user input so it matches literally.
 * Run via: make dev-test-db (or make dev-test for the full suite)
 */

import { requireTestDatabase, truncateAllTables, disconnectPrisma } from '@test/utils/db';
import { prisma } from '@/lib/prisma/client';
import { escapeLikePattern } from '@/lib/utils/search';
import { PrismaAuditLogService } from '../audit-log';
import { PrismaMappTeamService } from '../mapp-team';
import { PrismaCompanyUserService } from '../company-user';

const auditLogService = new PrismaAuditLogService();
const mappTeamService = new PrismaMappTeamService();
const companyUserService = new PrismaCompanyUserService();

describe('Search escaping (db)', () => {
  beforeAll(() => {
    requireTestDatabase();
  });

  beforeEach(async () => {
    await truncateAllTables();
    await prisma.auditLog.createMany({
      data: [
        { action: 'updated', entityType: 'account', message: 'discount set to 50% off' },
        { action: 'updated', entityType: 'account', message: 'renamed to 50 items' },
        { action: 'updated', entityType: 'account', message: 'path C:\\temp set' },
        { action: 'updated', entityType: 'account', message: 'feature_flag enabled' },
        { action: 'updated', entityType: 'account', message: 'featureXflag enabled' },
      ],
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it('a raw % in Prisma contains is a wildcard (why escaping is needed)', async () => {
    const raw = await prisma.auditLog.count({
      where: { message: { contains: '%', mode: 'insensitive' } },
    });
    expect(raw).toBe(5);

    const escaped = await prisma.auditLog.count({
      where: { message: { contains: escapeLikePattern('%'), mode: 'insensitive' } },
    });
    expect(escaped).toBe(1);
  });

  it('audit log search matches %, _ and \\ literally', async () => {
    const messages = async (search: string) =>
      (await auditLogService.listPaginated({ search, limit: 10, offset: 0 })).rows.map(
        (r) => r.message,
      );

    expect(await messages('%')).toEqual(['discount set to 50% off']);
    expect(await messages('50%')).toEqual(['discount set to 50% off']);
    expect(await messages('%%')).toEqual([]);
    expect(await messages('feature_flag')).toEqual(['feature_flag enabled']);
    expect(await messages('C:\\temp')).toEqual(['path C:\\temp set']);
    // Ordinary searches are unaffected.
    expect((await messages('50')).sort()).toEqual(
      ['discount set to 50% off', 'renamed to 50 items'].sort(),
    );
  });

  it('team member search matches % literally', async () => {
    await prisma.mappTeam.createMany({
      data: [
        { email: 'ada@mapp.com', firstname: 'Ada', lastname: 'Admin' },
        { email: 'bob@mapp.com', firstname: 'Bob', lastname: 'Builder' },
      ],
    });

    expect(await mappTeamService.searchTeamMembers('%')).toEqual([]);
    expect(await mappTeamService.searchTeamMembers('_')).toEqual([]);
    expect((await mappTeamService.searchTeamMembers('ada')).map((m) => m.email)).toEqual([
      'ada@mapp.com',
    ]);
    expect(await mappTeamService.getTeamMembersWithFilters({ searchTerm: '%' })).toEqual([]);
  });

  it('company user search matches _ literally', async () => {
    await prisma.companyUser.createMany({
      data: [
        { mappUserId: '1', companyId: 7, loginName: 'acme.jane_doe', name: 'Jane Doe' },
        { mappUserId: '2', companyId: 7, loginName: 'acme.janeXdoe', name: 'Jane X' },
      ],
    });

    const logins = async (search: string) =>
      (
        await companyUserService.listPaginatedWithAccount({ search, limit: 10, offset: 0 })
      ).rows.map((r) => r.loginName);

    expect(await logins('jane_doe')).toEqual(['acme.jane_doe']);
    expect(await logins('%')).toEqual([]);
    // A plain number still matches the company id.
    expect((await logins('7')).length).toBe(2);
  });
});
