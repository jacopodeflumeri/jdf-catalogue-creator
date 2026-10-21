import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/modules/auth/server";
import { config } from "@/config";
import { prismaService } from "@/lib/prisma/services";
import PageHeader from "@/components/ui/PageHeader";
import { canStartCustomerPreview } from "@/modules/customer_preview/server";
import { CustomerPreviewNotice } from "@/modules/customer_preview/client";
import { pageTitle } from "@/lib/utils/metadata";
import CompanyUsersClient, {
  type CompanyUserRow,
  type SortKey,
} from "./CompanyUsersClient";

export const metadata: Metadata = {
  title: pageTitle("Company Users"),
  description: "People who sign in via Company Login, grouped by company",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const SORT_KEYS: SortKey[] = ["user", "company", "mappUserId", "lastLogin"];

interface PageProps {
  searchParams: Promise<{
    q?: string;
    page?: string;
    sort?: string;
    dir?: string;
    /** Set by "View as customer" when a preview ends here. */
    preview?: string;
  }>;
}

export default async function CompanyUsersPage({ searchParams }: PageProps) {
  const session = await requireAdmin();

  // Company Login capability only (off for Mapp-internal-only apps).
  if (!config.companyLogin.enabled) {
    notFound();
  }

  const sp = await searchParams;
  const query = (sp.q ?? "").trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const sortKey: SortKey = SORT_KEYS.includes(sp.sort as SortKey)
    ? (sp.sort as SortKey)
    : "company";
  const sortDir = sp.dir === "asc" ? "asc" : "desc";

  // Server-side search/sort/pagination — company_user grows with the whole
  // customer base, so we never ship the full table to the client.
  const { rows: users, total } =
    await prismaService.companyUser.listPaginatedWithAccount({
      search: query || undefined,
      sortKey,
      sortDir,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });

  const rows: CompanyUserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    loginName: u.loginName,
    mappUserId: u.mappUserId,
    lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
    companyId: u.companyId,
    companyName: u.account?.name ?? null,
    accountId: u.account?.id ?? null,
  }));

  return (
    <div className="px-8 py-6 space-y-8">
      <PageHeader
        title="Company Users"
        description="People who sign in via Company Login (Mapp Cloud). Mapp employees who administer this app are under Mapp Team."
      />
      <CustomerPreviewNotice status={sp.preview} />
      <CompanyUsersClient
        rows={rows}
        canPreviewAsCustomer={canStartCustomerPreview(session)}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        query={query}
        sortKey={sortKey}
        sortDir={sortDir}
      />
    </div>
  );
}
