import "dotenv/config";
import { defineConfig } from "prisma/config";

// Build DATABASE_URL from individual DB_* env vars if not explicitly set.
// This lets developers configure only the DB_* variables in .env without
// also having to maintain a separate DATABASE_URL string.
function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5432";
  const user = process.env.DB_USER || "postgres";
  const password = process.env.DB_PASSWORD || "localdev";
  const name = process.env.DB_NAME || "myapp";
  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: getDatabaseUrl(),
  },
});
