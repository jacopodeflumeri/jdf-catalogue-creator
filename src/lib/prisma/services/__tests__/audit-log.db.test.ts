/**
 * @jest-environment node
 */

/**
 * Audit Log — Database Tests (writer + read service against real PostgreSQL).
 * Run via: make dev-test-db (or make dev-test for the full suite)
 */

import { requireTestDatabase, truncateAllTables, disconnectPrisma } from '@test/utils/db';
import { prisma } from '@/lib/prisma/client';
import { writeAuditLog } from '@/modules/audit/write';
import { PrismaAuditLogService } from '../audit-log';

const auditLogService = new PrismaAuditLogService();

describe('Audit log (db)', () => {
  beforeAll(() => {
    requireTestDatabase();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it('records a change and lists it with the acting team member', async () => {
    const admin = await prisma.mappTeam.create({
      data: { email: 'admin@mapp.com', firstname: 'Ada', lastname: 'Admin' },
    });

    await writeAuditLog({
      mappUserId: admin.id,
      actorEmail: 'admin@mapp.com',
      action: 'access_updated',
      entityType: 'mapp_team',
      entityId: 99,
      message: 'jane@mapp.com: level set to editor',
      data: { accessLevel: 'editor' },
    });

    const { rows, total } = await auditLogService.listPaginated({ limit: 10, offset: 0 });

    expect(total).toBe(1);
    expect(rows[0]).toMatchObject({
      action: 'access_updated',
      entityType: 'mapp_team',
      entityId: 99,
      outcome: 'success',
      actorEmail: 'admin@mapp.com',
      data: { accessLevel: 'editor' },
      mappUser: { id: admin.id, firstname: 'Ada', lastname: 'Admin' },
    });
  });

  it('keeps the row when the acting member does not exist', async () => {
    await writeAuditLog({
      mappUserId: 987654,
      actorEmail: 'ghost@mapp.com',
      action: 'access_updated',
      entityType: 'mapp_team',
    });

    const { rows } = await auditLogService.listPaginated({ limit: 10, offset: 0 });

    expect(rows).toHaveLength(1);
    expect(rows[0].mappUserId).toBeNull();
    expect(rows[0].actorEmail).toBe('ghost@mapp.com');
  });

  it('keeps history, and the name of who did it, after the team member is deleted', async () => {
    const admin = await prisma.mappTeam.create({ data: { email: 'leaver@mapp.com' } });
    await writeAuditLog({
      mappUserId: admin.id,
      actorEmail: 'leaver@mapp.com',
      action: 'access_granted',
      entityType: 'mapp_team',
    });

    await prisma.mappTeam.delete({ where: { id: admin.id } });

    const { rows } = await auditLogService.listPaginated({ limit: 10, offset: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0].mappUserId).toBeNull();
    expect(rows[0].actorEmail).toBe('leaver@mapp.com');
  });

  it('lists newest first, paginates, and filters by type and search', async () => {
    for (let i = 1; i <= 5; i++) {
      await writeAuditLog({
        actorEmail: i % 2 ? 'odd@mapp.com' : 'even@mapp.com',
        action: 'access_updated',
        entityType: 'mapp_team',
        entityId: i,
        message: `change number ${i}`,
      });
    }

    const firstPage = await auditLogService.listPaginated({ limit: 2, offset: 0 });
    expect(firstPage.total).toBe(5);
    expect(firstPage.rows.map((r) => r.entityId)).toEqual([5, 4]);

    const secondPage = await auditLogService.listPaginated({ limit: 2, offset: 2 });
    expect(secondPage.rows.map((r) => r.entityId)).toEqual([3, 2]);

    const byActor = await auditLogService.listPaginated({ search: 'EVEN@', limit: 10, offset: 0 });
    expect(byActor.total).toBe(2);

    const byMessage = await auditLogService.listPaginated({ search: 'number 3', limit: 10, offset: 0 });
    expect(byMessage.rows.map((r) => r.entityId)).toEqual([3]);

    const otherType = await auditLogService.listPaginated({ entityType: 'something_else', limit: 10, offset: 0 });
    expect(otherType.total).toBe(0);
  });
});
