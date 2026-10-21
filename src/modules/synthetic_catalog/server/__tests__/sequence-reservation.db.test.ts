/** @jest-environment node */

import { prisma } from "@/lib/prisma/client";
import {
  disconnectPrisma,
  requireTestDatabase,
  truncateAllTables,
} from "@test/utils/db";
import { reserveProductSequenceRange } from "../sequence-reservation";

describe("product sequence reservations", () => {
  beforeAll(() => requireTestDatabase());
  beforeEach(() => truncateAllTables());
  afterAll(() => disconnectPrisma());

  it("atomically reserves non-overlapping ranges", async () => {
    const catalog = await prisma.syntheticCatalog.create({
      data: {
        slug: "sequence-test",
        name: "Sequence Test",
        segment: "test",
        brandName: "Test Brand",
        externalPrefix: "TST",
        config: {},
        defaultTextModel: "openai/gpt-5.4-mini",
        defaultImageModel: "openai/gpt-image-2",
      },
    });

    const ranges = await Promise.all([
      reserveProductSequenceRange(catalog.id, 3),
      reserveProductSequenceRange(catalog.id, 2),
    ]);

    const reserved = ranges.flatMap((range) => range.sequences).sort((a, b) => a - b);
    expect(reserved).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(reserved).size).toBe(5);

    const updated = await prisma.syntheticCatalog.findUniqueOrThrow({
      where: { id: catalog.id },
    });
    expect(updated.nextProductSequence).toBe(6);
  });
});
