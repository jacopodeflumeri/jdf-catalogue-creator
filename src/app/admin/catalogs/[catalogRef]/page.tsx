import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/modules/auth/server";
import { pageTitle } from "@/lib/utils/metadata";
import { getCatalogDetail } from "@/modules/synthetic_catalog/server/admin-catalogs";
import CatalogDetailClient from "./CatalogDetailClient";

export const metadata: Metadata = {
  title: pageTitle("Catalog"),
  description: "Synthetic catalog generation and product preview",
};

export default async function CatalogDetailPage({
  params,
}: {
  params: Promise<{ catalogRef: string }>;
}) {
  const session = await requireAdmin({});
  const { catalogRef } = await params;
  const detail = await getCatalogDetail(catalogRef);
  if (!detail) notFound();
  const accessLevel = session.user.access ?? "viewer";
  const canEdit = session.user.isSuperAdmin === true || accessLevel === "editor" || accessLevel === "admin";
  return <CatalogDetailClient initialDetail={detail} canEdit={canEdit} />;
}
