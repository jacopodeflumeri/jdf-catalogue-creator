/**
 * Prisma Client Instance
 * Singleton pattern for database connection management with enhanced error handling
 * and graceful shutdown support
 */

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "@/config";
import logger from "@/lib/utils/logger";
import { pgAdapterErrorHooks } from "./pg-pool-errors";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Build DATABASE_URL from DB_* env vars if it isn't set explicitly. Matches
// prisma.config.ts and prisma/seed.ts behavior so the runtime app, migrations,
// and seed all connect to the same database when developers leave
// DATABASE_URL commented out in .env (per the .env.example default).
function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5432";
  const user = process.env.DB_USER || "postgres";
  const password = encodeURIComponent(process.env.DB_PASSWORD || "");
  const name = process.env.DB_NAME;
  if (!name) {
    throw new Error("Cannot build DATABASE_URL: DB_NAME is not set in env");
  }
  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

function createPrismaClient(): PrismaClient {
  const useSSL = process.env.DB_SSL === "true";
  // The second argument logs pool/connection errors (e.g. an RDS restart
  // dropping idle connections) at error level; see pg-pool-errors.ts.
  const adapter = new PrismaPg(
    {
      connectionString: resolveDatabaseUrl(),
      max: parseInt(process.env.DB_MAX_CONNECTIONS || "10", 10),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || "10000", 10),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000", 10),
      ...(useSSL && { ssl: { rejectUnauthorized: false } }),
    },
    pgAdapterErrorHooks,
  );

  return new PrismaClient({
    adapter,
    log: config.app.isDevelopment
      ? [
          { emit: "event", level: "query" },
          { emit: "stdout", level: "error" },
          { emit: "stdout", level: "warn" },
        ]
      : ["error"],
  });
}

// Initialize Prisma Client with driver adapter
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Log slow queries in development
if (config.app.isDevelopment) {
  prisma.$on("query" as never, (e: any) => {
    if (e.duration > 100) {
      // Log queries taking more than 100ms
      logger.warn("Slow query detected", {
        duration: `${e.duration}ms`,
      });
    }
  });
}

// Only set global in development to prevent hot reload issues
if (config.app.isDevelopment) {
  globalForPrisma.prisma = prisma;
}

/**
 * Health check helper
 * Tests database connectivity without establishing a permanent connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error("Database health check failed:", error);
    return false;
  }
}

/**
 * Graceful shutdown handler
 * Ensures all database connections are properly closed
 */
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received. Shutting down Prisma gracefully...`);
  try {
    await prisma.$disconnect();
    logger.info("Prisma disconnected successfully");
    process.exit(0);
  } catch (error) {
    logger.error("Error during Prisma shutdown:", error);
    process.exit(1);
  }
}

// Register shutdown handlers for graceful termination
if (
  typeof process !== "undefined" &&
  process.env.PRISMA_MANAGES_PROCESS_SIGNALS !== "false"
) {
  // Handle SIGINT (Ctrl+C)
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Handle SIGTERM (docker stop, kubernetes, etc.)
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

  // Handle process exit
  process.on("beforeExit", async () => {
    try {
      await prisma.$disconnect();
    } catch (error) {
      logger.error("Error disconnecting Prisma on beforeExit:", error);
    }
  });
}

