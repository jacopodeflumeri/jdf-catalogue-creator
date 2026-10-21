/** @jest-environment node */

/**
 * The DB test helper's safety check must never print credentials.
 */

jest.mock('@/lib/prisma/client', () => ({ prisma: {} }));

import { requireTestDatabase } from '../db';
import { redactDatabaseUrl } from '../db-url';

const SECRET = 's3cr3t-password';

describe('redactDatabaseUrl', () => {
  it('masks the password and keeps the rest', () => {
    expect(redactDatabaseUrl(`postgresql://postgres:${SECRET}@localhost:5432/myapp_test`)).toBe(
      'postgresql://postgres:***@localhost:5432/myapp_test',
    );
  });

  it('leaves a password-less url alone', () => {
    expect(redactDatabaseUrl('postgresql://postgres@localhost/myapp_test')).toBe(
      'postgresql://postgres@localhost/myapp_test',
    );
  });

  it('never echoes a missing or unparseable value', () => {
    expect(redactDatabaseUrl(undefined)).toBe('(not set)');
    expect(redactDatabaseUrl(`not a url ${SECRET}`)).not.toContain(SECRET);
  });
});

describe('requireTestDatabase', () => {
  const saved = { url: process.env.DATABASE_URL, testUrl: process.env.DATABASE_URL_TEST };

  afterEach(() => {
    process.env.DATABASE_URL = saved.url;
    process.env.DATABASE_URL_TEST = saved.testUrl;
    if (saved.url === undefined) delete process.env.DATABASE_URL;
    if (saved.testUrl === undefined) delete process.env.DATABASE_URL_TEST;
  });

  it('names the real make targets when DATABASE_URL_TEST is missing', () => {
    delete process.env.DATABASE_URL_TEST;
    expect(() => requireTestDatabase()).toThrow(/make dev-test-db/);
  });

  it('reports a mismatch without the passwords', () => {
    process.env.DATABASE_URL = `postgresql://app:${SECRET}@db.example:5432/myapp`;
    process.env.DATABASE_URL_TEST = `postgresql://postgres:${SECRET}-test@localhost:5432/myapp_test`;
    let message = '';
    try {
      requireTestDatabase();
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain('does not match');
    expect(message).toContain('db.example:5432/myapp');
    expect(message).not.toContain(SECRET);
  });

  it('passes when both point at the same database', () => {
    process.env.DATABASE_URL = 'postgresql://postgres:x@localhost:5432/myapp_test';
    process.env.DATABASE_URL_TEST = process.env.DATABASE_URL;
    expect(() => requireTestDatabase()).not.toThrow();
  });
});
