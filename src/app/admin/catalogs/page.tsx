import type { Metadata } from "next";
import { requireAdmin } from "@/modules/auth/server";
import { pageTitle } from "@/lib/utils/metadata";
import { getCatalogOverview } from "@/modules/synthetic_catalog/server/admin-catalogs";
import CatalogOverviewClient from "./CatalogOverviewClient";

export const metadata: Metadata = {
  title: pageTitle("Synthetic Catalogs"),
  description: "Create and manage internal synthetic fashion catalogs",
};

export default async function CatalogsPage() {
  const session = await requireAdmin({});
  const accessLevel = session.user.access ?? "viewer";
  const canEdit = session.user.isSuperAdmin === true || accessLevel === "editor" || accessLevel === "admin";
  const catalogs = await getCatalogOverview();
  return <CatalogOverviewClient initialCatalogs={catalogs} canEdit={canEdit} />;
}
