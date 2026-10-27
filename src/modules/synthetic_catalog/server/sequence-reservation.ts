import { prisma } from "@/lib/prisma/client";
import { POSTGRES_INT_MAX, productSequenceRange } from "../domain/ids";

export interface ReservedProductSequenceRange {
  first: number;
  last: number;
  sequences: number[];
}

/**
 * Atomically reserves a never-reused range for one catalog. Gaps are allowed:
 * once reserved, a failed generation must not put identifiers back into use.
 */
export async function reserveProductSequenceRange(
  catalogId: number,
  count: number,
): Promise<ReservedProductSequenceRange> {
  productSequenceRange(1, count);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM synthetic_catalog WHERE id = ${catalogId} FOR UPDATE`;
    const catalog = await tx.syntheticCatalog.findFirst({
      where: { id: catalogId, active: true },
      select: { nextProductSequence: true },
    });
    if (!catalog) throw new Error("Catalogue is not active");
    if (count > POSTGRES_INT_MAX - catalog.nextProductSequence) {
      throw new Error(`Product sequence capacity exhausted: PostgreSQL Int supports values through ${POSTGRES_INT_MAX}`);
    }
    const updated = await tx.syntheticCatalog.update({
      where: { id: catalogId },
      data: { nextProductSequence: { increment: count } },
      select: { nextProductSequence: true },
    });

    const first = updated.nextProductSequence - count;
    const sequences = productSequenceRange(first, count);
    return { first, last: sequences.at(-1)!, sequences };
  });
}
