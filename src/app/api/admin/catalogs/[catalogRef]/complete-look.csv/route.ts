import { NextResponse } from "next/server";
import { getAdminSession } from "@/modules/auth/server";
import { sessionAuditActor, writeAuditLog } from "@/modules/audit";
import { createCompleteLookCsvExport } from "@/modules/synthetic_catalog/server/catalog-export";

function safeFilename(slug: string): string {
  const safe = slug.replace(/[^a-z0-9_-]/gi, "-").replace(/-+/g, "-");
  return `${safe || "catalog"}-complete-the-look.csv`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ catalogRef: string }> },
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { catalogRef } = await params;
  const result = await createCompleteLookCsvExport(catalogRef);
  if (!result) return NextResponse.json({ error: "Catalog not found" }, { status: 404 });

  await writeAuditLog({
    ...sessionAuditActor(session),
    action: "exported_csv",
    entityType: "synthetic_catalog",
    entityId: result.catalog.id,
    message: `Exported ${result.rowCount} Complete the Look relationship rows from ${result.catalog.name}`,
    data: { export: "complete_look_relationships", rows: result.rowCount },
  });

  return new NextResponse(result.csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilename(result.catalog.slug)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
