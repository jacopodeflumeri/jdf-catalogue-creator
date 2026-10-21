/**
 * Database Test Utilities
 *
 * Helpers for database-backed tests (*.db.test.ts files).
 * Usage:
 *   beforeAll(() => requireTestDatabase());
 *   beforeEach(() => truncateAllTables());
 *   afterAll(() => disconnectPrisma());
 */

import { prisma } from '@/lib/prisma/client';
import { redactDatabaseUrl } from './db-url';

/**
 * Validates that the test database is properly configured.
 * Call this in beforeAll() of every database test suite.
 * Throws if DATABASE_URL_TEST is not set or DATABASE_URL doesn't match.
 */
export function requireTestDatabase(): void {
  const testUrl = process.env.DATABASE_URL_TEST;
  const currentUrl = process.env.DATABASE_URL;

  if (!testUrl) {
    throw new Error(
      'DATABASE_URL_TEST is not set. Run tests via `make dev-test` or `make dev-test-db` ' +
      'which sets this automatically, or set it manually.'
    );
  }

  // Passwords are masked: this message lands in the console and CI logs.
  if (currentUrl !== testUrl) {
    throw new Error(
      'DATABASE_URL does not match DATABASE_URL_TEST. ' +
      'This is a safety check to prevent tests from running against a non-test database.\n' +
      `DATABASE_URL: ${redactDatabaseUrl(currentUrl)}\n` +
      `DATABASE_URL_TEST: ${redactDatabaseUrl(testUrl)}`
    );
  }
}

// Tables in deletion order (children before parents to respect FK constraints)
const TABLES = [
  'catalog_generation_task',
  'synthetic_image_asset',
  'synthetic_variant',
  'synthetic_style',
  'synthetic_product',
  'catalog_generation_job',
  'synthetic_catalog',
  'account_activity',
  'account_notifications',
  'account_data',
  'account_user',
  'magic_link',
  'auth_session',
  'company_user',
  'audit_log',
  'mapp_team',
  'user',
  'account',
] as const;

/**
 * Truncates all application tables with RESTART IDENTITY CASCADE.
 * Call this in beforeEach() for a clean slate between tests.
 */
export async function truncateAllTables(): Promise<void> {
  for (const table of TABLES) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`
    );
  }
}

/**
 * Disconnects the Prisma client.
 * Call this in afterAll() to clean up connections.
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
