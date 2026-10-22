import { prisma } from "@/lib/prisma/client";
import type { PlannedOutfit } from "../domain/outfit-planner";
import type { Prisma } from "@/generated/prisma/client";

export async function persistCompleteLookPlan(plan: PlannedOutfit) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM synthetic_style WHERE id = ${plan.anchor.id} FOR UPDATE`;
    const existing = await tx.syntheticCompleteLook.findUnique({
      where: { anchorStyleId: plan.anchor.id },
      include: { items: true },
    });
    if (existing && ["READY", "QUEUED", "GENERATING"].includes(existing.status)) return existing;
    const look = existing
      ? await tx.syntheticCompleteLook.update({
          where: { id: existing.id },
          data: {
            status: plan.status,
            selectionReason: plan.reason,
            scoringSnapshot: plan.scoringSnapshot as Prisma.InputJsonValue,
            errorMessage: plan.status === "SKIPPED" ? plan.reason : null,
            imageAssetId: null,
          },
        })
      : await tx.syntheticCompleteLook.create({
          data: {
            anchorStyleId: plan.anchor.id,
            status: plan.status,
            selectionReason: plan.reason,
            scoringSnapshot: plan.scoringSnapshot as Prisma.InputJsonValue,
            errorMessage: plan.status === "SKIPPED" ? plan.reason : null,
          },
        });
    await tx.syntheticCompleteLookItem.deleteMany({ where: { completeLookId: look.id } });
    if (plan.items.length) {
      await tx.syntheticCompleteLookItem.createMany({
        data: plan.items.map((item, sortOrder) => ({
          completeLookId: look.id,
          companionStyleId: item.style.id,
          outfitSlot: item.outfitSlot,
          sortOrder,
          scoreSnapshot: { score: item.score, reason: item.reason },
        })),
      });
    }
    return tx.syntheticCompleteLook.findUniqueOrThrow({ where: { id: look.id }, include: { items: true } });
  });
}
