/**
 * @jest-environment node
 */

/**
 * Customer preview — the template's default subject seam WITHOUT the client
 * catalog: a company is previewable once one of its users has logged in
 * (`company_user`), named after its linked Account, with no workspaces; and
 * the "View as customer" audit rows land under entity type `company`.
 * Run via: make dev-test-db (or make dev-test for the full suite)
 */

import { requireTestDatabase, truncateAllTables, disconnectPrisma } from '@test/utils/db';
import { prisma } from '@/lib/prisma/client';
import { writeAuditLog } from '@/modules/audit/write';
import { resolvePreviewSubject } from '../config/subject';

describe('resolvePreviewSubject — company_user stub (db)', () => {
  const savedBaseUrl = process.env.CLIENT_CATALOG_BASE_URL;

  beforeAll(() => {
    requireTestDatabase();
    delete process.env.CLIENT_CATALOG_BASE_URL;
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    if (savedBaseUrl !== undefined) process.env.CLIENT_CATALOG_BASE_URL = savedBaseUrl;
    await disconnectPrisma();
  });

  it('is null for a company none of whose users has logged in', async () => {
    await expect(resolvePreviewSubject(5046)).resolves.toBeNull();
  });

  it("names the company after the most recent login's linked account", async () => {
    const account = await prisma.account.create({
      data: { name: 'acme', companyName: 'Acme Retail' },
    });
    await prisma.companyUser.create({
      data: { mappUserId: 'u1', companyId: 5046, lastLoginAt: new Date('2026-01-01') },
    });
    await prisma.companyUser.create({
      data: {
        mappUserId: 'u2',
        companyId: 5046,
        accountId: account.id,
        lastLoginAt: new Date('2026-06-01'),
      },
    });

    await expect(resolvePreviewSubject(5046)).resolves.toEqual({
      companyId: 5046,
      // The template's resolveAccountIdForCompany returns null; an app's
      // override flows through here exactly as at login.
      accountId: null,
      name: 'Acme Retail',
      workspaces: [],
      services: [],
    });
  });

  it('falls back to "Company <id>" for an unlinked company', async () => {
    await prisma.companyUser.create({ data: { mappUserId: 'u1', companyId: 77 } });
    await expect(resolvePreviewSubject(77)).resolves.toMatchObject({ name: 'Company 77' });
  });

  it('accepts the company entity type in the audit log', async () => {
    await writeAuditLog({
      actorEmail: 'admin@mapp.com',
      action: 'customer_preview_start',
      entityType: 'company',
      entityId: 5046,
      message: 'Started viewing Acme Retail as a customer',
    });
    const row = await prisma.auditLog.findFirst({ where: { entityType: 'company' } });
    expect(row).toMatchObject({ action: 'customer_preview_start', entityId: 5046 });
  });
});
