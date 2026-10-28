import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/modules/auth/server";
import { pageTitle } from "@/lib/utils/metadata";
import { getCatalogDetail } from "@/modules/synthetic_catalog/server/admin-catalogs";
import { getCatalogExportSummary, getCompleteLookExportSummary } from "@/modules/synthetic_catalog/server/catalog-export";
import CatalogDetailClient from "./CatalogDetailClient";

export const metadata: Metadata = {
  title: pageTitle("Catalog"),
  description: "Synthetic catalog generation and product preview",
};

export default async function CatalogDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ catalogRef: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdmin({});
  const [{ catalogRef }, query] = await Promise.all([params, searchParams]);
  const initialSearch = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) for (const item of value) initialSearch.append(key, item);
    else if (value != null) initialSearch.set(key, value);
  }
  const [detail, exportSummary, completeLookExportSummary] = await Promise.all([
    getCatalogDetail(catalogRef),
    getCatalogExportSummary(catalogRef),
    getCompleteLookExportSummary(catalogRef),
  ]);
  if (!detail) notFound();
  const accessLevel = session.user.access ?? "viewer";
  const canEdit = session.user.isSuperAdmin === true || accessLevel === "editor" || accessLevel === "admin";
  const canDelete = session.user.isSuperAdmin === true || accessLevel === "admin";
  return <CatalogDetailClient initialDetail={detail} initialExportSummary={exportSummary} initialCompleteLookExportSummary={completeLookExportSummary} canEdit={canEdit} canDelete={canDelete} initialSearch={initialSearch.toString()} />;
}
