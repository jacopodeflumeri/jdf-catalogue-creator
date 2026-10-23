"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import FormInput from "@/components/ui/form/FormInput";
import { saveCatalogDesignMixAction } from "@/modules/synthetic_catalog/server/admin-actions";
import type { CatalogDetailView } from "@/modules/synthetic_catalog/admin/types";

export default function DesignMixEditor({ detail, canEdit, onSaved }: { detail: CatalogDetailView; canEdit: boolean; onSaved: () => Promise<void> }) {
  const initial = detail.catalog.designMix;
  const [mix, setMix] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const set = (key: "patternPercentage" | "embellishmentPercentage" | "maxCombinedPercentage", value: string) => setMix((current) => ({ ...current, [key]: Number(value) }));
  const updateRule = (rowId: string, key: "allowedPatternCodes" | "allowedEmbellishmentCodes", value: string) => setMix((current) => {
    const prior = current.rules.find((rule) => rule.catalogMixRowId === rowId) ?? { catalogMixRowId: rowId, allowedPatternCodes: [], allowedEmbellishmentCodes: [] };
    const rules = current.rules.filter((rule) => rule.catalogMixRowId !== rowId);
    rules.push({ ...prior, [key]: value.split(",").map((code) => code.trim().toUpperCase()).filter(Boolean) });
    return { ...current, rules };
  });
  const save = async () => {
    setBusy(true); setMessage("");
    const result = await saveCatalogDesignMixAction({ catalogId: detail.catalog.id, designMix: mix });
    setBusy(false);
    if (!result.ok) { setMessage(result.message ?? "Could not save design mix"); return; }
    setMessage("Design mix saved"); await onSaved();
  };
  const vocabulary = (title: string, entries: Array<{ code: string; label: string }>) => <p className="text-sm text-[#1a1a1a]/65">{title}: {entries.map((entry) => `${entry.code} (${entry.label})`).join(", ")}</p>;
  return <section className="space-y-4 rounded-xl border border-[#1a1a1a]/10 p-5">
    <div><h3 className="font-semibold">Design Mix</h3><p className="text-sm text-[#1a1a1a]/60">Set exact product targets and the design types allowed for each Catalogue Mix row.</p></div>
    <div className="grid gap-4 md:grid-cols-3">
      <FormInput id="pattern-percent" label="Patterned products (%)" type="number" min="0" max="100" value={mix.patternPercentage} disabled={!canEdit} onChange={(e) => set("patternPercentage", e.target.value)} />
      <FormInput id="embellishment-percent" label="Embellished products (%)" type="number" min="0" max="100" value={mix.embellishmentPercentage} disabled={!canEdit} onChange={(e) => set("embellishmentPercentage", e.target.value)} />
      <FormInput id="combined-percent" label="Maximum containing both (%)" type="number" min="0" max="100" value={mix.maxCombinedPercentage} disabled={!canEdit || !mix.allowCombined} onChange={(e) => set("maxCombinedPercentage", e.target.value)} />
    </div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mix.allowCombined} disabled={!canEdit} onChange={(e) => setMix((current) => ({ ...current, allowCombined: e.target.checked, maxCombinedPercentage: e.target.checked ? current.maxCombinedPercentage : 0 }))} /> Allow products to contain both</label>
    {vocabulary("Patterns", mix.patterns)}{vocabulary("Embellishments", mix.embellishments)}
    <div className="space-y-3"><h4 className="text-sm font-medium">Compatibility by Catalogue Mix row</h4>
      {detail.catalog.assortmentPlan.map((row) => {
        const rule = mix.rules.find((entry) => entry.catalogMixRowId === row.id);
        return <div key={row.id} className="grid gap-3 border-t border-[#1a1a1a]/10 pt-3 md:grid-cols-3"><p className="text-sm">{row.category} / {row.subcategory}</p>
          <FormInput id={`patterns-${row.id}`} label="Allowed pattern codes" placeholder="Default by category" value={rule?.allowedPatternCodes.join(", ") ?? ""} disabled={!canEdit} onChange={(e) => updateRule(row.id, "allowedPatternCodes", e.target.value)} />
          <FormInput id={`embellishments-${row.id}`} label="Allowed embellishment codes" placeholder="Default by category" value={rule?.allowedEmbellishmentCodes.join(", ") ?? ""} disabled={!canEdit} onChange={(e) => updateRule(row.id, "allowedEmbellishmentCodes", e.target.value)} />
        </div>;
      })}
    </div>
    {canEdit && <Button type="button" loading={busy} onClick={() => void save()}>Save Design Mix</Button>}{message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
