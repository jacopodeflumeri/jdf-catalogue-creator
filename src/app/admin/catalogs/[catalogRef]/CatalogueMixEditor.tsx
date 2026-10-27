"use client";

import { Fragment, useState } from "react";
import Button from "@/components/ui/Button";
import CollapsibleCard from "@/components/ui/CollapsibleCard";
import FormInput from "@/components/ui/form/FormInput";
import FormSelect from "@/components/ui/form/FormSelect";
import Icon from "@/components/ui/Icon";
import NoticeBox from "@/components/ui/NoticeBox";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import type { CatalogDetailView } from "@/modules/synthetic_catalog/admin/types";
import { OUTFIT_SLOTS } from "@/modules/synthetic_catalog/config/profiles";
import { saveCatalogMixAction } from "@/modules/synthetic_catalog/server/admin-actions";

type MixRow = CatalogDetailView["catalog"]["assortmentPlan"][number];
let nextEditorRowId = 0;
function newEditorRowId(): string {
  nextEditorRowId += 1;
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `catalogue-mix-new-${nextEditorRowId}`;
}

export default function CatalogueMixEditor({ detail, canEdit, onSaved }: { detail: CatalogDetailView; canEdit: boolean; onSaved: () => Promise<void> }) {
  const [rows, setRows] = useState<MixRow[]>(() => detail.catalog.assortmentPlan);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const { confirm } = useConfirm();

  function rowError(row: MixRow): string | null {
    if (!row.category.trim()) return "Category is required.";
    if (!row.subcategory.trim()) return "Subcategory is required.";
    if (row.departmentKey == null) {
      if (row.productCount !== 0 || row.outfitSlot != null) return "Unassigned rows need zero products and no outfit slot.";
    } else {
      if (!detail.catalog.departments.some((department) => department.key === row.departmentKey)) return "Choose a configured department.";
      if (!OUTFIT_SLOTS.includes(row.outfitSlot as typeof OUTFIT_SLOTS[number])) return "Choose an outfit slot.";
      if (!Number.isSafeInteger(row.productCount) || row.productCount < 1) return "Product count must be a positive integer.";
    }
    const tuple = [row.departmentKey ?? "", row.category, row.subcategory].map((value) => value.trim().toLocaleLowerCase()).join("\u0000");
    if (rows.some((candidate) => candidate.id !== row.id && [candidate.departmentKey ?? "", candidate.category, candidate.subcategory].map((value) => value.trim().toLocaleLowerCase()).join("\u0000") === tuple)) return "This mix row already exists.";
    return null;
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    const result = await saveCatalogMixAction({ catalogId: detail.catalog.id, rows });
    setBusy(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.message ?? "Could not save catalogue mix" });
      return;
    }
    setMessage({ kind: "success", text: "Catalogue mix saved for future jobs" });
    await onSaved();
  }

  function updateRow(id: string, update: Partial<MixRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...update } : row));
  }

  return (
    <CollapsibleCard title="Catalogue mix" description="Each row defines an allowed department, category, and subcategory combination and its exact All Catalogue quota. Edits only affect future jobs.">
      <div className="space-y-3">
        <div className="ds-table-shell overflow-hidden"><div className="overflow-x-auto"><table className="w-full">
          <thead className="ds-table-head"><tr>{["Department", "Category", "Subcategory", "Products", "Outfit slot", ...(canEdit ? ["Actions"] : [])].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1a1a1a]/55">{heading}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <Fragment key={row.id}><tr className="ds-table-row">
            <td className="min-w-48 px-3 py-2"><FormSelect label="Department" value={row.departmentKey ?? ""} disabled={!canEdit || busy} onChange={(event) => updateRow(row.id, { departmentKey: event.target.value || null, ...(event.target.value ? {} : { productCount: 0, outfitSlot: null }) })} options={[{ value: "", label: "Unassigned" }, ...detail.catalog.departments.map((item) => ({ value: item.key, label: item.label }))]} /></td>
            <td className="min-w-48 px-3 py-2"><FormInput label="Category" value={row.category} disabled={!canEdit || busy} onChange={(event) => updateRow(row.id, { category: event.target.value })} /></td>
            <td className="min-w-48 px-3 py-2"><FormInput label="Subcategory" value={row.subcategory} disabled={!canEdit || busy} onChange={(event) => updateRow(row.id, { subcategory: event.target.value })} /></td>
            <td className="w-32 px-3 py-2"><FormInput label="Products" type="number" min={row.departmentKey == null ? "0" : "1"} step="1" value={String(row.productCount)} disabled={!canEdit || busy || row.departmentKey == null} onChange={(event) => updateRow(row.id, { productCount: Number(event.target.value) })} /></td>
            <td className="min-w-40 px-3 py-2"><FormSelect label="Outfit slot" value={row.outfitSlot ?? ""} disabled={!canEdit || busy || row.departmentKey == null} onChange={(event) => updateRow(row.id, { outfitSlot: event.target.value as MixRow["outfitSlot"] })} options={[{ value: "", label: "Choose outfit slot" }, ...OUTFIT_SLOTS.map((slot) => ({ value: slot, label: slot.replaceAll("_", " ") }))]} /></td>
            {canEdit && <td className="px-3 py-2 text-right"><Button type="button" variant="danger" size="sm" disabled={busy} onClick={async () => {
              const accepted = await confirm({ title: "Remove catalogue mix row?", message: "This only changes future generation. Existing products remain unchanged.", confirmText: "Remove row", variant: "danger" });
              if (accepted) setRows((current) => current.filter((item) => item.id !== row.id));
            }}>Remove</Button></td>}
          </tr>{rowError(row) && <tr><td colSpan={canEdit ? 6 : 5} className="px-4 py-2 text-sm text-danger" role="alert">{rowError(row)}</td></tr>}</Fragment>)}</tbody>
        </table></div></div>
        {!canEdit && rows.length === 0 && <p className="text-sm text-[#1a1a1a]/55">No catalogue mix rows are configured.</p>}
        {rows.length === 0 && <NoticeBox variant="error">At least one catalogue mix row is required.</NoticeBox>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold">All Catalogue total: {rows.reduce((total, row) => total + (Number.isSafeInteger(row.productCount) && row.productCount > 0 ? row.productCount : 0), 0)} products</p>
          {canEdit && <div className="flex gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setRows((current) => [...current, { id: newEditorRowId(), departmentKey: null, category: "", subcategory: "", productCount: 0, outfitSlot: null }])}><Icon type="plus" size="sm" /> Add row</Button><Button type="button" loading={busy} disabled={rows.length === 0 || rows.some((row) => rowError(row) != null)} onClick={() => void save()}><Icon type="save" size="sm" /> Save catalogue mix</Button></div>}
        </div>
        {message && <NoticeBox variant={message.kind}>{message.text}</NoticeBox>}
      </div>
    </CollapsibleCard>
  );
}
