import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageTitle } from "@/lib/utils/metadata";
import { requireAdmin } from "@/modules/auth/server";
import { getCatalogProductDetail } from "@/modules/synthetic_catalog/server/admin-catalogs";
import ProductDetailClient from "./ProductDetailClient";

export const metadata: Metadata = {
  title: pageTitle("Catalog product"),
  description: "Synthetic catalog product details and generated imagery",
};

export default async function CatalogProductPage({
  params,
}: {
  params: Promise<{ catalogRef: string; productRef: string }>;
}) {
  const session = await requireAdmin({});
  const { catalogRef, productRef } = await params;
  const detail = await getCatalogProductDetail(catalogRef, productRef);
  if (!detail) notFound();

  const accessLevel = session.user.access ?? "viewer";
  const canEdit =
    session.user.isSuperAdmin === true || accessLevel === "editor" || accessLevel === "admin";

  return <ProductDetailClient initialDetail={detail} canEdit={canEdit} />;
}
