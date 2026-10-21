/**
 * The audit-log writer. Call it from any server action that changes something
 * an admin would later ask "who did that, and when?" about.
 *
 *   await writeAuditLog({
 *     ...sessionAuditActor(session),
 *     action: "access_updated",
 *     entityType: "mapp_team",
 *     entityId: member.id,
 *     message: `Access level set to editor for ${member.email}`,
 *     data: { accessLevel: "editor" },
 *   });
 *
 * `entityType` is typed from AUDIT_ENTITY_TYPES, so a type that cannot be
 * filtered in the UI cannot be written in the first place.
 */

import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import logger from "@/lib/utils/logger";
import type { AuditEntityType } from "./entity-types";

export interface WriteAuditLogParams {
  mappUserId?: number | null;
  actorEmail?: string | null;
  /** Verb, snake_case: "created", "access_updated", "deleted". */
  action: string;
  entityType: AuditEntityType;
  entityId?: number | null;
  outcome?: "success" | "error";
  /** One human-readable line; this is what the audit-log table shows. */
  message?: string;
  /** Structured detail (e.g. before/after). Never put secrets in here. */
  data?: unknown;
}

function toAuditRow(
  params: WriteAuditLogParams,
): Prisma.AuditLogUncheckedCreateInput {
  return {
    mappUserId: params.mappUserId ?? null,
    actorEmail: params.actorEmail ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    outcome: params.outcome ?? "success",
    message: params.message,
    data:
      params.data === undefined || params.data === null
        ? undefined
        : (params.data as Prisma.InputJsonValue),
  };
}

/**
 * Write one audit row. NEVER throws: a failed audit write must not fail, or
 * appear to fail, the change it describes. Failures are logged.
 */
export async function writeAuditLog(
  params: WriteAuditLogParams,
): Promise<void> {
  const row = toAuditRow(params);
  try {
    await prisma.auditLog.create({ data: row });
  } catch (err) {
    // P2003 = the mappUserId no longer matches a MappTeam row (stale session
    // after a DB reset, deleted member). Keep the row; drop the link. The
    // actorEmail still says who it was.
    if ((err as { code?: string } | null)?.code === "P2003" && row.mappUserId) {
      try {
        await prisma.auditLog.create({ data: { ...row, mappUserId: null } });
        return;
      } catch (retryErr) {
        logger.error("Failed to write audit log:", retryErr);
        return;
      }
    }
    logger.error("Failed to write audit log:", err);
  }
}

/**
 * Transaction-aware variant, for a change made inside `prisma.$transaction`.
 *
 * A row written on the outer client would survive a rollback and record a
 * change that never happened; passing `tx` keeps it atomic with the change.
 * Unlike `writeAuditLog` this DOES throw — a swallowed error inside a
 * transaction still poisons it, so the caller has to see it.
 */
export async function writeAuditLogTx(
  tx: Prisma.TransactionClient,
  params: WriteAuditLogParams,
): Promise<void> {
  await tx.auditLog.create({ data: toAuditRow(params) });
}
