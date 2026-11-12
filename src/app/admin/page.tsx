import type { Metadata } from "next";
import { requireAdmin } from "@/modules/auth/server";
import { pageTitle } from "@/lib/utils/metadata";
import { getCatalogueDashboard } from "@/modules/synthetic_catalog/server/dashboard";
import CatalogDashboard from "./CatalogDashboard";

export const metadata: Metadata = {
  title: pageTitle("Dashboard"),
  description: "Operational summary of the generated catalogue estate",
};

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await requireAdmin({});
  const params = await searchParams;
  const dashboard = await getCatalogueDashboard(first(params.range));
  return <CatalogDashboard dashboard={dashboard} />;
}
