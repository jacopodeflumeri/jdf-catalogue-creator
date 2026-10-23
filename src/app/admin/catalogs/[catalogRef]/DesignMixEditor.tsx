"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import FormInput from "@/components/ui/form/FormInput";
import { saveCatalogDesignMixAction } from "@/modules/synthetic_catalog/server/admin-actions";
import type { CatalogDetailView } from "@/modules/synthetic_catalog/admin/types";

export default function DesignMixEditor({ detail, canEdit, onSaved }: { detail: CatalogDetailView; canEdit: boolean; onSaved: () => Promise<void> }) {
  const initial = detail.catalog.designMix;
  const [mix, setMix] = useState(initial);
  const [patternVocabularyText, setPatternVocabularyText] = useState(initial.patterns.map((item) => `${item.code}: ${item.label}`).join(", "));
  const [embellishmentVocabularyText, setEmbellishmentVocabularyText] = useState(initial.embellishments.map((item) => `${item.code}: ${item.label}`).join(", "));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const set = (key: "patternPercentage" | "embellishmentPercentage" | "maxCombinedPercentage", value: string) => setMix((current) => ({ ...current, [key]: Number(value) }));
  const updateRule = (rowId: string, key: "allowedPatternCodes" | "allowedEmbellishmentCodes", value: string) => setMix((current) => {
    const prior = current.rules.find((rule) => rule.catalogMixRowId === rowId) ?? { catalogMixRowId: rowId, allowedPatternCodes: [], allowedEmbellishmentCodes: [] };
    const rules = current.rules.filter((rule) => rule.catalogMixRowId !== rowId);
    rules.push({ ...prior, [key]: value.split(",").map((code) => code.trim().toUpperCase()).filter(Boolean) });
    return { ...current, rules };
  });
  const commitVocabulary = (key: "patterns" | "embellishments", value: string) => setMix((current) => ({
    ...current,
    [key]: value.split(",").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
      const [rawCode, ...labelParts] = entry.split(":");
      const code = rawCode!.trim().toUpperCase().replaceAll("-", "_").replaceAll(" ", "_");
      return { code, label: labelParts.join(":").trim() || code.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()) };
    }),
  }));
  const save = async () => {
    setBusy(true); setMessage("");
    const result = await saveCatalogDesignMixAction({ catalogId: detail.catalog.id, designMix: mix });
    setBusy(false);
    if (!result.ok) { setMessage(result.message ?? "Could not save design mix"); return; }
    setMessage("Design mix saved"); await onSaved();
  };
  return <section className="space-y-4 rounded-xl border border-[#1a1a1a]/10 p-5">
    <div><h3 className="font-semibold">Design Mix</h3><p className="text-sm text-[#1a1a1a]/60">Set exact product targets and the design types allowed for each Catalogue Mix row.</p></div>
    {canEdit ? <>
    <div className="grid gap-4 md:grid-cols-3">
      <FormInput id="pattern-percent" label="Patterned products (%)" type="number" min="0" max="100" value={mix.patternPercentage} disabled={!canEdit} onChange={(e) => set("patternPercentage", e.target.value)} />
      <FormInput id="embellishment-percent" label="Embellished products (%)" type="number" min="0" max="100" value={mix.embellishmentPercentage} disabled={!canEdit} onChange={(e) => set("embellishmentPercentage", e.target.value)} />
      <FormInput id="combined-percent" label="Maximum containing both (%)" type="number" min="0" max="100" value={mix.maxCombinedPercentage} disabled={!canEdit || !mix.allowCombined} onChange={(e) => set("maxCombinedPercentage", e.target.value)} />
    </div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mix.allowCombined} disabled={!canEdit} onChange={(e) => setMix((current) => ({ ...current, allowCombined: e.target.checked, maxCombinedPercentage: e.target.checked ? current.maxCombinedPercentage : 0 }))} /> Allow products to contain both</label>
    <div className="grid gap-4 md:grid-cols-2">
      <FormInput id="pattern-vocabulary" label="Allowed pattern vocabulary" value={patternVocabularyText} disabled={!canEdit} onChange={(e) => setPatternVocabularyText(e.target.value)} onBlur={() => commitVocabulary("patterns", patternVocabularyText)} helpText="Comma-separated CODE: Label entries. SOLID means no pattern and should not be listed." />
      <FormInput id="embellishment-vocabulary" label="Allowed embellishment vocabulary" value={embellishmentVocabularyText} disabled={!canEdit} onChange={(e) => setEmbellishmentVocabularyText(e.target.value)} onBlur={() => commitVocabulary("embellishments", embellishmentVocabularyText)} helpText="Comma-separated CODE: Label entries." />
    </div>
    </> : <div className="space-y-2 text-sm"><p>Patterned products: {mix.patternPercentage}% · Embellished products: {mix.embellishmentPercentage}% · Combined: {mix.allowCombined ? `allowed up to ${mix.maxCombinedPercentage}%` : "disabled"}</p><p>Patterns: {mix.patterns.map((item) => `${item.code} (${item.label})`).join(", ") || "None"}</p><p>Embellishments: {mix.embellishments.map((item) => `${item.code} (${item.label})`).join(", ") || "None"}</p></div>}
    <div className="space-y-3"><h4 className="text-sm font-medium">Compatibility by Catalogue Mix row</h4>
      {detail.catalog.assortmentPlan.map((row) => {
        const rule = mix.rules.find((entry) => entry.catalogMixRowId === row.id);
        return <div key={row.id} className="grid gap-3 border-t border-[#1a1a1a]/10 pt-3 md:grid-cols-4"><p className="text-sm">{row.category} / {row.subcategory}</p>
          {canEdit ? <>
            <FormInput id={`patterns-${row.id}`} label="Allowed pattern codes" placeholder="Default by category" value={rule?.allowedPatternCodes.join(", ") ?? ""} onChange={(e) => updateRule(row.id, "allowedPatternCodes", e.target.value)} />
            <FormInput id={`embellishments-${row.id}`} label="Allowed embellishment codes" placeholder="Default by category" value={rule?.allowedEmbellishmentCodes.join(", ") ?? ""} onChange={(e) => updateRule(row.id, "allowedEmbellishmentCodes", e.target.value)} />
            <Button type="button" variant="ghost" onClick={() => setMix((current) => ({ ...current, rules: current.rules.filter((entry) => entry.catalogMixRowId !== row.id) }))}>Use category defaults</Button>
          </> : <p className="col-span-3 text-sm text-[#1a1a1a]/65">{rule ? `Patterns: ${rule.allowedPatternCodes.join(", ") || "none"}; embellishments: ${rule.allowedEmbellishmentCodes.join(", ") || "none"}` : "Category defaults"}</p>}
        </div>;
      })}
    </div>
    {canEdit && <Button type="button" loading={busy} onClick={() => void save()}>Save Design Mix</Button>}{message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
