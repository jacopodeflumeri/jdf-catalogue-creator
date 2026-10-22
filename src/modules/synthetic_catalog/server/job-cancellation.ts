import { prisma } from "@/lib/prisma/client";

export class CatalogJobCancelledError extends Error {
  constructor() {
    super("Catalog generation job was cancelled");
    this.name = "CatalogJobCancelledError";
  }
}

export async function assertCatalogJobActive(jobId: number): Promise<void> {
  const job = await prisma.catalogGenerationJob.findUniqueOrThrow({
    where: { id: jobId },
    select: { status: true },
  });
  if (job.status === "CANCELLED") throw new CatalogJobCancelledError();
}
