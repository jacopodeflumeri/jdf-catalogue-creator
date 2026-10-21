/** @jest-environment node */

/**
 * The real thing, against the test Postgres: an idle connection in Prisma's
 * pool is killed from outside (what an RDS restart or failover does). The
 * process survives, the drop is logged at error level, and the next query
 * simply opens a new connection.
 */

import { Client } from "pg";

const error = jest.fn();
jest.mock("@/lib/utils/logger", () => ({
  __esModule: true,
  default: {
    error: (...args: unknown[]) => error(...args),
    warn: jest.fn(),
    info: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
  },
}));

import { prisma } from "@/lib/prisma/client";
import { disconnectPrisma, requireTestDatabase } from "@test/utils/db";

beforeAll(() => requireTestDatabase());
afterAll(() => disconnectPrisma());

async function waitFor(condition: () => boolean, ms = 5_000): Promise<void> {
  const until = Date.now() + ms;
  while (!condition() && Date.now() < until) await new Promise((r) => setTimeout(r, 25));
}

it("an idle pooled connection killed by the database is logged and the pool recovers", async () => {
  // One query, then the connection sits idle in the adapter's pool.
  const [{ pid }] = await prisma.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;

  // Kill it from a separate connection, so the pool's own client isn't the killer.
  const killer = new Client({ connectionString: process.env.DATABASE_URL });
  await killer.connect();
  try {
    await killer.query("SELECT pg_terminate_backend($1)", [pid]);
  } finally {
    await killer.end();
  }
  await waitFor(() => error.mock.calls.length > 0);

  expect(error).toHaveBeenCalledTimes(1);
  const line = String(error.mock.calls[0][0]);
  expect(line).toContain("[db] idle pool client dropped");
  expect(line).toMatch(/57P01|terminat/i); // "terminating connection due to administrator command"
  expect(JSON.stringify(error.mock.calls)).not.toContain(process.env.DATABASE_URL);

  // The next query opens a new connection.
  const [{ pid: next }] = await prisma.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
  expect(next).not.toBe(pid);
});
