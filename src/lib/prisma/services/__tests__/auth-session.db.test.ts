/**
 * @jest-environment node
 */

/**
 * Auth Session Service — Database Tests
 *
 * These tests run against a real PostgreSQL test database.
 * Run via: make dev-test-db (or make dev-test for the full suite)
 */

import { requireTestDatabase, truncateAllTables, disconnectPrisma } from '@test/utils/db';
import { PrismaAuthSessionService } from '../auth-session';

const authSessionService = new PrismaAuthSessionService();

const inOneHour = () => new Date(Date.now() + 60 * 60 * 1000);
const oneHourAgo = () => new Date(Date.now() - 60 * 60 * 1000);

const claims = {
  roles: ['labs-user'],
  workspaces: [{ workspaceId: 'ws-1', services: ['engage', 'intelligence'] }],
  mappLdapGroups: ['LABS-ADMIN', 'LABS-PRODUCT'],
};

describe('Auth session service (db)', () => {
  beforeAll(() => {
    requireTestDatabase();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it('round-trips the claims and keeps the id_token out of getClaims', async () => {
    const id = await authSessionService.create({
      email: 'user@example.com',
      ...claims,
      keycloakIdToken: 'header.payload.signature',
      expiresAt: inOneHour(),
    });

    const stored = await authSessionService.getClaims(id);

    expect(stored).toEqual({ ...claims, expiresAt: expect.any(Date) });
    expect(stored).not.toHaveProperty('keycloakIdToken');
    expect(await authSessionService.getKeycloakIdToken(id)).toBe('header.payload.signature');
  });

  it('gives each login its own row', async () => {
    const a = await authSessionService.create({ ...claims, expiresAt: inOneHour() });
    const b = await authSessionService.create({ ...claims, expiresAt: inOneHour() });

    expect(a).not.toBe(b);
  });

  it('returns null for an unknown or expired session', async () => {
    const expired = await authSessionService.create({ ...claims, expiresAt: oneHourAgo() });

    expect(await authSessionService.getClaims('does-not-exist')).toBeNull();
    expect(await authSessionService.getClaims(expired)).toBeNull();
  });

  it('extends a session so it is live again', async () => {
    const id = await authSessionService.create({ ...claims, expiresAt: oneHourAgo() });

    await authSessionService.extend(id, inOneHour());

    expect(await authSessionService.getClaims(id)).not.toBeNull();
  });

  it('deletes a session, and tolerates deleting one that is already gone', async () => {
    const id = await authSessionService.create({ ...claims, expiresAt: inOneHour() });

    await authSessionService.delete(id);
    await authSessionService.delete(id);

    expect(await authSessionService.getClaims(id)).toBeNull();
    expect(await authSessionService.getKeycloakIdToken(id)).toBeNull();
  });

  it('prunes only expired sessions', async () => {
    const live = await authSessionService.create({ ...claims, expiresAt: inOneHour() });
    await authSessionService.create({ ...claims, expiresAt: oneHourAgo() });
    await authSessionService.create({ ...claims, expiresAt: oneHourAgo() });

    expect(await authSessionService.deleteExpired()).toBe(2);
    expect(await authSessionService.getClaims(live)).not.toBeNull();
  });
});
