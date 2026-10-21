import type { Metadata } from "next";
import { requireAdmin } from "@/modules/auth/server";
import { prismaService } from "@/lib/prisma/services";
import PageHeader from "@/components/ui/PageHeader";
import { pageTitle } from "@/lib/utils/metadata";
import { isAuditEntityType } from "@/modules/audit/entity-types";
import AuditLogClient, { type AuditLogRow } from "./AuditLogClient";

export const metadata: Metadata = {
  title: pageTitle("Audit Log"),
  description: "Who changed what, and when",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; type?: string }>;
}

export default async function AuditLogPage({ searchParams }: PageProps) {
  // Read-only: any active admin, whatever their level.
  await requireAdmin({});

  const sp = await searchParams;
  const query = (sp.q ?? "").trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const entityType = isAuditEntityType(sp.type) ? sp.type : undefined;

  const { rows: logs, total } = await prismaService.auditLog.listPaginated({
    entityType,
    search: query || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const rows: AuditLogRow[] = logs.map((log) => {
    const name = [log.mappUser?.firstname, log.mappUser?.lastname]
      .filter(Boolean)
      .join(" ");
    return {
      id: log.id,
      createdAt: log.createdAt.toISOString(),
      actorName: name || null,
      actorEmail: log.mappUser?.email ?? log.actorEmail ?? null,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      outcome: log.outcome,
      message: log.message,
      data: log.data === null ? null : JSON.stringify(log.data, null, 2),
    };
  });

  return (
    <div className="px-8 py-6 space-y-8">
      <PageHeader
        title="Audit Log"
        description="A record of changes made by admins in this app: who changed what, and when."
      />
      <AuditLogClient
        rows={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        query={query}
        entityType={entityType ?? null}
      />
    </div>
  );
}
