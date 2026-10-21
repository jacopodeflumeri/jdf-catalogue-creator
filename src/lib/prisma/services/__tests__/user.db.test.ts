/**
 * @jest-environment node
 */

/**
 * User Service — Database Tests
 *
 * These tests run against a real PostgreSQL test database.
 * Run via: make dev-test-db (or make dev-test for the full suite)
 */

import { requireTestDatabase, truncateAllTables, disconnectPrisma } from '@test/utils/db';
import { PrismaUserService } from '../user';

const userService = new PrismaUserService();

describe('User service (db)', () => {
  beforeAll(() => {
    requireTestDatabase();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe('createUser', () => {
    it('creates a user with required fields', async () => {
      const user = await userService.createUser({
        email: 'test@example.com',
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.mapp).toBe(false);
      expect(user.accountId).toBeNull();
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('creates a user with all fields', async () => {
      const user = await userService.createUser({
        email: 'full@example.com',
        name: 'Full User',
        mapp: true,
      });

      expect(user.email).toBe('full@example.com');
      expect(user.name).toBe('Full User');
      expect(user.mapp).toBe(true);
    });

    it('rejects duplicate emails', async () => {
      await userService.createUser({ email: 'dupe@example.com' });

      await expect(
        userService.createUser({ email: 'dupe@example.com' })
      ).rejects.toThrow();
    });
  });

  describe('getUserByEmail', () => {
    it('finds an existing user', async () => {
      await userService.createUser({
        email: 'findme@example.com',
        name: 'Find Me',
      });

      const found = await userService.getUserByEmail('findme@example.com');

      expect(found).not.toBeNull();
      expect(found!.name).toBe('Find Me');
    });

    it('returns null for non-existent email', async () => {
      const found = await userService.getUserByEmail('nobody@example.com');
      expect(found).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('updates user fields', async () => {
      const user = await userService.createUser({
        email: 'update@example.com',
        name: 'Before',
      });

      const updated = await userService.updateUser(String(user.id), {
        name: 'After',
        mapp: true,
      });

      expect(updated.name).toBe('After');
      expect(updated.mapp).toBe(true);
      expect(updated.email).toBe('update@example.com');
    });
  });

  describe('deleteUser', () => {
    it('deletes an existing user', async () => {
      const user = await userService.createUser({
        email: 'delete@example.com',
      });

      const result = await userService.deleteUser(String(user.id));
      expect(result).toBe(true);

      const found = await userService.getUserByEmail('delete@example.com');
      expect(found).toBeNull();
    });
  });

  describe('getUsers', () => {
    it('returns all users ordered by createdAt desc', async () => {
      await userService.createUser({ email: 'first@example.com', name: 'First' });
      await userService.createUser({ email: 'second@example.com', name: 'Second' });

      const users = await userService.getUsers();

      expect(users).toHaveLength(2);
      // Most recent first
      expect(users[0].email).toBe('second@example.com');
      expect(users[1].email).toBe('first@example.com');
    });
  });
});
