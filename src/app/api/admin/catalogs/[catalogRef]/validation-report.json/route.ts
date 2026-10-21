import { NextResponse } from "next/server";
import { getAdminSession } from "@/modules/auth/server";
import { createCatalogValidationReport } from "@/modules/synthetic_catalog/server/catalog-export";

function safeFilename(slug: string): string {
  const safe = slug.replace(/[^a-z0-9_-]/gi, "-").replace(/-+/g, "-");
  return `${safe || "catalog"}-validation-report.json`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ catalogRef: string }> },
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { catalogRef } = await params;
  const report = await createCatalogValidationReport(catalogRef);
  if (!report) return NextResponse.json({ error: "Catalog not found" }, { status: 404 });

  return NextResponse.json(report, {
    headers: {
      "Content-Disposition": `attachment; filename="${safeFilename(report.catalog.slug)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
