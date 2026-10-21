"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import { CustomerPreviewLauncher } from "@/modules/customer_preview/client";

export type CompanyUserRow = {
  id: number;
  name: string | null;
  email: string | null;
  loginName: string | null;
  mappUserId: string;
  lastLoginAt: string | null;
  companyId: number;
  companyName: string | null;
  accountId: number | null;
};

export type SortKey = "user" | "company" | "mappUserId" | "lastLogin";
type SortDir = "asc" | "desc";

interface Props {
  rows: CompanyUserRow[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
  sortKey: SortKey;
  sortDir: SortDir;
  /**
   * "View as customer" launch points (optional customer_preview capability):
   * computed on the server with `canStartCustomerPreview(session)` — false
   * hides them (capability off, or not an admin-level user).
   */
  canPreviewAsCustomer?: boolean;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

function SortHeader({
  label,
  columnKey,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  columnKey: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  return (
    <th className="px-4 py-3 font-semibold">
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className="inline-flex items-center gap-1 hover:text-primary transition-colors"
      >
        {label}
        {sortKey === columnKey && (
          <span className="text-primary">{sortDir === "asc" ? "▲" : "▼"}</span>
        )}
      </button>
    </th>
  );
}

export default function CompanyUsersClient({
  rows,
  total,
  page,
  pageSize,
  query,
  sortKey,
  sortDir,
  canPreviewAsCustomer = false,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(query);

  const buildHref = (overrides: {
    q?: string;
    page?: number;
    sort?: SortKey;
    dir?: SortDir;
  }) => {
    const next = { q: query, page, sort: sortKey, dir: sortDir, ...overrides };
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    if (next.sort && next.sort !== "company") params.set("sort", next.sort);
    if (next.dir && next.dir !== "desc") params.set("dir", next.dir);
    const qs = params.toString();
    return qs ? `/admin/company-users?${qs}` : "/admin/company-users";
  };

  // Keep the input in sync when the URL query changes (back/forward).
  useEffect(() => {
    setQ(query);
  }, [query]);

  // Debounced auto-apply when the user types something different.
  useEffect(() => {
    if (q === query) return;
    const t = setTimeout(() => {
      startTransition(() =>
        router.push(buildHref({ q: q || undefined, page: 1 })),
      );
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const onSort = (key: SortKey) => {
    const dir: SortDir =
      sortKey === key ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    startTransition(() => router.push(buildHref({ sort: key, dir, page: 1 })));
  };

  const go = (toPage: number) =>
    startTransition(() => router.push(buildHref({ page: toPage })));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <Card noPaddingContent>
      <div className="p-4 border-b border-white/60">
        <div className="relative max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1a1a1a]/40">
            <Icon type="search" size="sm" />
          </span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company, user, email, or Mapp Cloud ID…"
            className="w-full rounded-xl border border-white/85 bg-[rgba(255,255,255,0.58)] pl-9 pr-3 py-2 text-sm text-[#1a1a1a] outline-none transition-all focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <p className="mt-2 text-xs text-[#1a1a1a]/45">
          {total === 0
            ? "No matching users"
            : `Showing ${from}–${to} of ${total} user${total === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className={`overflow-x-auto ${isPending ? "opacity-60" : ""}`}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/60 text-[11px] uppercase tracking-wide text-[#1a1a1a]/45">
              <SortHeader label="User" columnKey="user" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Company" columnKey="company" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <th className="px-4 py-3 font-semibold">Login</th>
              <SortHeader label="Mapp Cloud ID" columnKey="mappUserId" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Last login" columnKey="lastLogin" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#1a1a1a]/55">
                  No matching users.
                </td>
              </tr>
            ) : (
              rows.map((u, i) => (
                <tr
                  key={u.id}
                  className="border-b border-white/40 last:border-b-0 align-top"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#1a1a1a]">
                      {u.name || u.email || "—"}
                    </div>
                    {u.email && u.name && (
                      <div className="text-xs text-[#1a1a1a]/55">{u.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {/* The per-company detail route ships with the client_catalog
                        capability scaffold (/admin/companies/[companyId]); plain
                        text here keeps the base template route-free. */}
                    <span className="text-[#1a1a1a]/80">
                      {u.companyName ?? `Company ${u.companyId}`}
                    </span>
                    <div className="text-xs text-[#1a1a1a]/45">ID {u.companyId}</div>
                    {/* One launch point per company: on the first of its rows
                        here (rows of a company are adjacent in the default
                        company sort). Workspaces are loaded on click. */}
                    {canPreviewAsCustomer && rows[i - 1]?.companyId !== u.companyId && (
                      <CustomerPreviewLauncher
                        allowed
                        companyId={u.companyId}
                        companyName={u.companyName}
                        className="mt-2"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[#1a1a1a]/80">
                    {u.loginName || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-[#1a1a1a]/80">
                    {u.mappUserId}
                  </td>
                  <td className="px-4 py-3 text-[#1a1a1a]/70">
                    {formatDate(u.lastLoginAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t border-white/60">
          <span className="text-xs text-[#1a1a1a]/45">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isPending}
              onClick={() => go(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isPending}
              onClick={() => go(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
