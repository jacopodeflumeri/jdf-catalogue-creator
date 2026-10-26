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
  searchParams,
}: {
  params: Promise<{ catalogRef: string; productRef: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdmin({});
  const [{ catalogRef, productRef }, query] = await Promise.all([params, searchParams]);
  const detail = await getCatalogProductDetail(catalogRef, productRef);
  if (!detail) notFound();

  const accessLevel = session.user.access ?? "viewer";
  const canEdit =
    session.user.isSuperAdmin === true || accessLevel === "editor" || accessLevel === "admin";

  const from = typeof query.from === "string" ? query.from : null;
  return <ProductDetailClient initialDetail={detail} canEdit={canEdit} from={from} />;
}
