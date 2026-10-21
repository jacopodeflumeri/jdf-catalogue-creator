/**
 * A normal rolling deployment starts the new application image before running
 * its Prisma migrations. The worker must therefore treat a missing queue table
 * as a temporary bootstrap state instead of terminating the essential ECS
 * container (which would also stop the web container needed by ECS Exec).
 */
export function isCatalogWorkerSchemaMissing(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2021";
}
