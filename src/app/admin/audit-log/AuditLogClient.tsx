"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import {
  AUDIT_ENTITY_TYPES,
  getAuditEntityTypeDef,
} from "@/modules/audit/entity-types";

export type AuditLogRow = {
  id: number;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: number | null;
  outcome: string | null;
  message: string | null;
  /** Pretty-printed JSON, or null when the row has no structured detail. */
  data: string | null;
};

interface Props {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
  entityType: string | null;
}

/** "access_updated" -> "Access updated" */
function humanize(action: string): string {
  const text = action.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function AuditLogClient({
  rows,
  total,
  page,
  pageSize,
  query,
  entityType,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(query);

  const buildHref = (overrides: {
    q?: string;
    page?: number;
    type?: string | null;
  }) => {
    const next = { q: query, page, type: entityType, ...overrides };
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.type) params.set("type", next.type);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const qs = params.toString();
    return qs ? `/admin/audit-log?${qs}` : "/admin/audit-log";
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

  const selectType = (type: string | null) =>
    startTransition(() => router.push(buildHref({ type, page: 1 })));

  const go = (toPage: number) =>
    startTransition(() => router.push(buildHref({ page: toPage })));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const isFiltered = Boolean(query || entityType);

  return (
    <Card noPaddingContent>
      <div className="p-4 border-b border-white/60 space-y-3">
        <div className="relative max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1a1a1a]/40">
            <Icon type="search" size="sm" />
          </span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by description, action, or who did it…"
            aria-label="Search the audit log"
            className="w-full rounded-xl border border-white/85 bg-[rgba(255,255,255,0.58)] pl-9 pr-3 py-2 text-sm text-[#1a1a1a] outline-none transition-all focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {AUDIT_ENTITY_TYPES.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={entityType === null ? "primary" : "outline"}
              size="sm"
              onClick={() => selectType(null)}
            >
              All
            </Button>
            {AUDIT_ENTITY_TYPES.map((def) => (
              <Button
                key={def.key}
                variant={entityType === def.key ? "primary" : "outline"}
                size="sm"
                onClick={() => selectType(def.key)}
              >
                {def.label}
              </Button>
            ))}
          </div>
        )}

        <p className="text-xs text-[#1a1a1a]/45">
          {total === 0
            ? isFiltered
              ? "No matching entries"
              : "No entries yet"
            : `Showing ${from}–${to} of ${total} entr${total === 1 ? "y" : "ies"}`}
        </p>
      </div>

      <div className={`overflow-x-auto ${isPending ? "opacity-60" : ""}`}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/60 text-[11px] uppercase tracking-wide text-[#1a1a1a]/45">
              <th className="px-4 py-3 font-semibold">When</th>
              <th className="px-4 py-3 font-semibold">Who</th>
              <th className="px-4 py-3 font-semibold">What</th>
              <th className="px-4 py-3 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-[#1a1a1a]/55"
                >
                  {isFiltered
                    ? "No matching entries."
                    : "Nothing has been recorded yet. Changes admins make will appear here."}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const def = getAuditEntityTypeDef(row.entityType);
                const href = def?.href?.(row.entityId);
                const label = def?.label ?? row.entityType;
                return (
                  <tr
                    key={row.id}
                    className="border-b border-white/40 last:border-b-0 align-top"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-[#1a1a1a]/70">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1a1a1a]">
                        {row.actorName || row.actorEmail || "Unknown"}
                      </div>
                      {row.actorName && row.actorEmail && (
                        <div className="text-xs text-[#1a1a1a]/55">
                          {row.actorEmail}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="gray" size="xs">
                          {href ? <Link href={href}>{label}</Link> : label}
                        </Badge>
                        <span className="text-[#1a1a1a]/80">
                          {humanize(row.action)}
                        </span>
                        {row.outcome === "error" && (
                          <Badge variant="danger" size="xs">
                            Failed
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#1a1a1a]/80">
                      {row.message || "—"}
                      {row.data && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-[#1a1a1a]/45 hover:text-primary transition-colors">
                            Show details
                          </summary>
                          <pre className="mt-2 max-w-xl overflow-x-auto rounded-xl bg-white/40 p-3 text-xs text-[#1a1a1a]/70">
                            {row.data}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                );
              })
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
