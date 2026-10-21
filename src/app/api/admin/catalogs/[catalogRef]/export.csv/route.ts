import { NextResponse } from "next/server";
import { config } from "@/config";
import { getAdminSession } from "@/modules/auth/server";
import { sessionAuditActor, writeAuditLog } from "@/modules/audit";
import { createCatalogCsvExport } from "@/modules/synthetic_catalog/server/catalog-export";

function safeFilename(slug: string): string {
  const safe = slug.replace(/[^a-z0-9_-]/gi, "-").replace(/-+/g, "-");
  return `${safe || "catalog"}.csv`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ catalogRef: string }> },
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { catalogRef } = await params;
  const requestOrigin = new URL(request.url).origin;
  const result = await createCatalogCsvExport(catalogRef, config.app.url || requestOrigin);
  if (!result) return NextResponse.json({ error: "Catalog not found" }, { status: 404 });
  if (result.summary.variantsExported === 0) {
    return NextResponse.json(
      { error: "Catalog has no exportable variants", summary: result.summary },
      { status: 422 },
    );
  }

  await writeAuditLog({
    ...sessionAuditActor(session),
    action: "exported_csv",
    entityType: "synthetic_catalog",
    entityId: result.catalog.id,
    message: `Exported ${result.summary.variantsExported} catalog rows from ${result.catalog.name}`,
    data: {
      products: result.summary.productsExported,
      styles: result.summary.stylesExported,
      variants: result.summary.variantsExported,
      excludedProducts: result.summary.incompleteProductsExcluded,
    },
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
