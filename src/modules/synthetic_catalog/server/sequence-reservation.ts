import { prisma } from "@/lib/prisma/client";
import { productSequenceRange } from "../domain/ids";

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

  const catalog = await prisma.syntheticCatalog.update({
    where: { id: catalogId },
    data: { nextProductSequence: { increment: count } },
    select: { nextProductSequence: true },
  });

  const first = catalog.nextProductSequence - count;
  const sequences = productSequenceRange(first, count);
  return { first, last: sequences.at(-1)!, sequences };
}
