"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import FormSelect from "@/components/ui/form/FormSelect";
import Icon from "@/components/ui/Icon";
import { getProductImageStatus } from "@/modules/synthetic_catalog/admin/product-image-status";
import type { CatalogProductView } from "@/modules/synthetic_catalog/admin/types";
import CatalogStatusBadge from "../CatalogStatusBadge";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import NoticeBox from "@/components/ui/NoticeBox";
import { archiveCatalogProductAction, restoreCatalogProductAction } from "@/modules/synthetic_catalog/server/admin-actions";

function formatMoney(value: string, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(value));
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ProductTable({
  catalogSlug,
  products,
  canEdit,
  onAddProducts,
  onArchiveChanged,
}: {
  catalogSlug: string;
  products: CatalogProductView[];
  canEdit: boolean;
  onAddProducts: () => void;
  onArchiveChanged: () => Promise<void>;
}) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [department, setDepartment] = useState("all");
  const [category, setCategory] = useState("all");
  const [subcategory, setSubcategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [recordState, setRecordState] = useState("ACTIVE");
  const [pendingProductId, setPendingProductId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const departments = useMemo(
    () => Array.from(new Map(products.map((product) => [product.departmentKey, product.department])).entries())
      .sort(([a], [b]) => a.localeCompare(b)),
    [products],
  );
  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category))).sort(),
    [products],
  );
  const subcategories = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .filter((product) => category === "all" || product.category === category)
            .map((product) => product.subcategory),
        ),
      ).sort(),
    [category, products],
  );
  const filtered = useMemo(
    () =>
      products.filter(
        (product) =>
          (department === "all" || product.departmentKey === department) &&
          (category === "all" || product.category === category) &&
          (subcategory === "all" || product.subcategory === subcategory) &&
          (recordState === "all" || (recordState === "ACTIVE" ? product.archivedAt == null : product.archivedAt != null)) &&
          (status === "all" || getProductImageStatus(product) === status),
      ),
    [category, department, products, recordState, status, subcategory],
  );
  const hasFilters = [department, category, subcategory, status].some((value) => value !== "all") || recordState !== "ACTIVE";

  function resetFilters() {
    setDepartment("all");
    setCategory("all");
    setSubcategory("all");
    setStatus("all");
    setRecordState("ACTIVE");
  }

  async function changeArchiveState(product: CatalogProductView) {
    if (product.archivedAt == null) {
      const approved = await confirm({ title: "Archive product?", message: "This hides the product from active counts and catalogue exports. Its styles, images and history will be preserved, and you can restore it later.", confirmText: "Archive product", variant: "danger" });
      if (!approved) return;
    }
    setPendingProductId(product.id);
    setMessage(null);
    const result = product.archivedAt == null ? await archiveCatalogProductAction(product.id) : await restoreCatalogProductAction(product.id);
    setPendingProductId(null);
    if (!result.ok) { setMessage(result.message ?? "Could not update product archive state"); return; }
    await onArchiveChanged();
    router.refresh();
  }

  if (products.length === 0) {
    return (
      <EmptyState
        className="mt-6"
        icon="fashion"
        title="No products yet"
        description="Queue the first generation job to build this catalog."
        action={
          canEdit ? (
            <Button onClick={onAddProducts}>
              <Icon type="plus" size="sm" /> Add products
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="glass-card rounded-2xl p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6 xl:items-end">
          <FormSelect label="Department" value={department} onChange={(event) => setDepartment(event.target.value)} options={[{ value: "all", label: "All departments" }, ...departments.map(([key, label]) => ({ value: key, label }))]} />
          <FormSelect label="Category" value={category} onChange={(event) => { setCategory(event.target.value); setSubcategory("all"); }} options={[{ value: "all", label: "All categories" }, ...categories.map((value) => ({ value, label: titleCase(value) }))]} />
          <FormSelect label="Subcategory" value={subcategory} onChange={(event) => setSubcategory(event.target.value)} options={[{ value: "all", label: "All subcategories" }, ...subcategories.map((value) => ({ value, label: titleCase(value) }))]} />
          <FormSelect label="Image status" value={status} onChange={(event) => setStatus(event.target.value)} options={[
            { value: "all", label: "All statuses" },
            { value: "READY", label: "Ready" },
            { value: "FAILED", label: "Failed" },
            { value: "GENERATING", label: "Generating" },
            { value: "MISSING", label: "Missing" },
          ]} />
          <FormSelect label="Products" value={recordState} onChange={(event) => setRecordState(event.target.value)} options={[{ value: "ACTIVE", label: "Active" }, { value: "ARCHIVED", label: "Archived" }, { value: "all", label: "Active and archived" }]} />
          <div className="flex items-center justify-between gap-3 pb-0.5 xl:justify-end">
            <p className="text-sm text-[#1a1a1a]/55">{filtered.length} of {products.length} products</p>
            {hasFilters && <Button variant="ghost" size="sm" onClick={resetFilters}>Clear</Button>}
          </div>
        </div>
      </div>
      {message && <NoticeBox variant="error">{message}</NoticeBox>}

      <div className="ds-table-shell overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="ds-table-head">
              <tr>
                {["Product", "Department", "Category", "Subcategory", "Material", "Styles", "Price", "Images", ...(canEdit ? ["Actions"] : [])].map((heading) => (
                  <th key={heading} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1a1a1a]/55">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => {
                const href = `/admin/catalogs/${encodeURIComponent(catalogSlug)}/products/${encodeURIComponent(product.externalId)}`;
                const front = product.styles.flatMap((style) => style.images).find((image) => image.role === "FRONT" && image.url);
                const displayPrice = product.salePrice ?? product.basePrice;
                return (
                  <tr key={product.id} title={`${product.name} · ${product.externalId}`} className={`ds-table-row cursor-pointer focus-visible:outline-none focus-visible:bg-white/55 ${product.archivedAt ? "opacity-60" : ""}`} role="link" tabIndex={0} onClick={() => router.push(href)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") router.push(href); }}>
                    <td className="px-5 py-3">
                      <div className="flex min-w-[240px] items-center gap-3">
                        <div className="relative h-14 w-11 flex-none overflow-hidden rounded-lg border border-white/70 bg-white/35">
                          {front?.url ? <Image src={front.url} alt="" fill sizes="44px" className="object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-[#1a1a1a]/35"><Icon type="camera" size="sm" /></div>}
                        </div>
                        <div className="min-w-0">
                          <Link href={href} className="block truncate text-sm font-semibold text-[#1a1a1a] hover:text-primary" onClick={(event) => event.stopPropagation()}>{product.name}</Link>
                          <p className="text-xs text-[#1a1a1a]/48">{product.externalId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm">{product.department}</td>
                    <td className="max-w-32 truncate px-5 py-4 text-sm capitalize" title={product.category}>{product.category}</td>
                    <td className="max-w-36 truncate px-5 py-4 text-sm capitalize" title={product.subcategory}>{product.subcategory}</td>
                    <td className="max-w-32 truncate px-5 py-4 text-sm capitalize" title={product.material}>{product.material}</td>
                    <td className="px-5 py-4 text-sm whitespace-nowrap">{product.styles.length} color styles</td>
                    <td className="px-5 py-4 text-sm font-semibold whitespace-nowrap">{formatMoney(displayPrice, product.currency)}</td>
                    <td className="px-5 py-4 text-sm whitespace-nowrap"><CatalogStatusBadge status={getProductImageStatus(product)} /></td>
                    {canEdit && <td className="px-3 py-3 text-right"><div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><Button variant="ghost" size="sm" loading={pendingProductId === product.id} disabled={pendingProductId != null} onClick={() => void changeArchiveState(product)}>{product.archivedAt ? "Restore" : "Archive"}</Button></div></td>}
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={canEdit ? 9 : 8} className="px-6 py-12 text-center"><p className="font-semibold text-[#1a1a1a]">No matching products</p><p className="mt-1 text-sm text-[#1a1a1a]/55">Clear or adjust the filters above.</p></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
