"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormCheckbox from "@/components/ui/form/FormCheckbox";
import FormInput from "@/components/ui/form/FormInput";
import FormSelect from "@/components/ui/form/FormSelect";
import Modal from "@/components/ui/modal/Modal";
import NoticeBox from "@/components/ui/NoticeBox";
import { estimateGenerationOutput } from "@/modules/synthetic_catalog/domain/colors";
import { createCatalogGenerationJobAction } from "@/modules/synthetic_catalog/server/admin-actions";

interface AddProductsModalProps {
  catalog: {
    id: number;
    name: string;
    estimatedSizesPerProduct: number;
    categorySizeCounts: Record<string, number>;
    departments: Array<{ key: string; label: string }>;
    categories: string[];
    maxProductsPerJob: number;
    largeJobThreshold: number;
  } | null;
  onClose: () => void;
  onCreated: (jobId: number) => void;
}

export default function AddProductsModal({ catalog, onClose, onCreated }: AddProductsModalProps) {
  const [step, setStep] = useState(0);
  const [scopeType, setScopeType] = useState<"ALL" | "DEPARTMENT" | "CATEGORY">("ALL");
  const [departmentKey, setDepartmentKey] = useState("");
  const [category, setCategory] = useState("");
  const [count, setCount] = useState(5);
  const [colorVariantCount, setColorVariantCount] = useState<2 | 3>(2);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!catalog) return null;
  const sizeCount = scopeType === "CATEGORY" ? catalog.categorySizeCounts[category] ?? catalog.estimatedSizesPerProduct : catalog.estimatedSizesPerProduct;
  const estimate = estimateGenerationOutput({ products: Math.max(0, count), colorVariantCount, sizeCount });
  const isLarge = count >= catalog.largeJobThreshold;
  const canContinueScope = scopeType === "ALL" || (scopeType === "DEPARTMENT" ? Boolean(departmentKey) : Boolean(category));

  async function submit() {
    if (!catalog || (isLarge && !confirmed)) return;
    setLoading(true);
    setError(null);
    const scope = scopeType === "ALL" ? { type: "ALL" as const }
      : scopeType === "DEPARTMENT" ? { type: "DEPARTMENT" as const, departmentKey }
        : { type: "CATEGORY" as const, category };
    const result = await createCatalogGenerationJobAction({ catalogId: catalog.id, requestedProducts: count, colorVariantCount, scope });
    setLoading(false);
    if (!result.ok || result.jobId == null) {
      setError(result.message ?? "Could not queue the generation job");
      return;
    }
    onCreated(result.jobId);
  }

  return (
    <Modal isOpen onClose={onClose} title={`Generate products for ${catalog.name}`} size="lg">
      <div className="mb-6 grid grid-cols-3 gap-2" aria-label="Generation steps">
        {["Scope", "Output", "Review"].map((label, index) => <div key={label} className={`rounded-xl border px-3 py-2 text-center text-sm ${step === index ? "border-primary bg-white/70 font-semibold text-primary" : "border-white/65 text-[#1a1a1a]/55"}`}>{index + 1}. {label}</div>)}
      </div>
      {step === 0 && <div className="space-y-5">
        <Card title="All catalogue" description="Distribute departments by configured weights and rotate through categories."><Button variant={scopeType === "ALL" ? "primary" : "secondary"} onClick={() => setScopeType("ALL")}>All catalogue</Button></Card>
        <Card title="Specific department" description="Every generated product will use this department.">
          <div className="flex gap-3"><Button variant={scopeType === "DEPARTMENT" ? "primary" : "secondary"} onClick={() => setScopeType("DEPARTMENT")}>Choose department</Button>{scopeType === "DEPARTMENT" && <FormSelect label="Department" value={departmentKey} onChange={(event) => setDepartmentKey(event.target.value)} options={catalog.departments.map((item) => ({ value: item.key, label: item.label }))} />}</div>
        </Card>
        <Card title="Specific category" description="Every generated product will use this category; subcategories and departments are distributed deterministically.">
          <div className="flex gap-3"><Button variant={scopeType === "CATEGORY" ? "primary" : "secondary"} onClick={() => setScopeType("CATEGORY")}>Choose category</Button>{scopeType === "CATEGORY" && <FormSelect label="Category" value={category} onChange={(event) => setCategory(event.target.value)} options={catalog.categories.map((value) => ({ value, label: value }))} />}</div>
        </Card>
      </div>}
      {step === 1 && <div className="space-y-5">
        <FormInput id="catalog-product-count" label="Number of products" type="number" min={1} max={catalog.maxProductsPerJob} value={count} onChange={(event) => setCount(Number(event.target.value))} helpText={`Products are parent records. Maximum ${catalog.maxProductsPerJob} products per job.`} />
        <FormSelect id="catalog-color-variants" label="Color variants per product" value={String(colorVariantCount)} onChange={(event) => setColorVariantCount(Number(event.target.value) as 2 | 3)} options={[{ value: "2", label: "2 colors" }, { value: "3", label: "3 colors" }]} helpText="One text call creates product copy shared by all styles. Each style gets its own sizes and three images." />
      </div>}
      {step === 2 && <div className="space-y-5">
        <Card title="Request summary" description={scopeType === "ALL" ? "All catalogue" : scopeType === "DEPARTMENT" ? `Department: ${catalog.departments.find((item) => item.key === departmentKey)?.label ?? departmentKey}` : `Category: ${category}`}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{[["Parent products", estimate.products], ["Color styles", estimate.styles], ["Images", estimate.images], ["Size rows", estimate.sizeRows], ["Attributed LiteLLM calls", estimate.liteLlmCalls]].map(([label, value]) => <div key={label} className="rounded-xl border border-white/70 bg-white/30 p-3"><p className="text-xl font-bold">{value}</p><p className="text-xs text-[#1a1a1a]/55">{label}</p></div>)}</div>
          <p className="mt-4 text-xs text-[#1a1a1a]/55">One text call per product, plus three image calls per color style. Generation runs in the background.</p>
        </Card>
        {isLarge && <NoticeBox variant="warning" title="Large generation job"><FormCheckbox id="confirm-large-catalog-job" label={`I confirm ${estimate.products} products, ${estimate.styles} styles, ${estimate.images} images, and ${estimate.liteLlmCalls} attributed LiteLLM calls`} checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} helpText="The job is queued for background processing." /></NoticeBox>}
      </div>}
      {error && <div className="mt-5"><NoticeBox variant="error">{error}</NoticeBox></div>}
      <div className="mt-6 flex justify-between gap-3">
        <Button variant="ghost" onClick={step === 0 ? onClose : () => setStep((value) => value - 1)} disabled={loading}>{step === 0 ? "Cancel" : "Back"}</Button>
        {step < 2 ? <Button onClick={() => setStep((value) => value + 1)} disabled={(step === 0 && !canContinueScope) || (step === 1 && (count < 1 || count > catalog.maxProductsPerJob))}>Continue</Button> : <Button onClick={() => void submit()} loading={loading} disabled={count < 1 || count > catalog.maxProductsPerJob || (isLarge && !confirmed)}>Queue generation</Button>}
      </div>
    </Modal>
  );
}
