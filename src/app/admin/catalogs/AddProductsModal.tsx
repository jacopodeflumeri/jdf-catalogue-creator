"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormCheckbox from "@/components/ui/form/FormCheckbox";
import FormInput from "@/components/ui/form/FormInput";
import FormSelect from "@/components/ui/form/FormSelect";
import Modal from "@/components/ui/modal/Modal";
import NoticeBox from "@/components/ui/NoticeBox";
import { estimateAssortmentOutput } from "@/modules/synthetic_catalog/domain/colors";
import { planAssortment } from "@/modules/synthetic_catalog/domain/planner";
import { createCatalogGenerationJobAction } from "@/modules/synthetic_catalog/server/admin-actions";

interface AddProductsModalProps {
  catalog: {
    id: number;
    slug: string;
    nextProductSequence: number;
    name: string;
    estimatedSizesPerProduct: number;
    categorySizeCounts: Record<string, number>;
    departments: Array<{ key: string; label: string }>;
    categories: string[];
    assortmentPlan: Array<{ departmentKey: string; category: string; subcategory: string; productCount: number }>;
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
  const configuredProductCount = catalog.assortmentPlan.reduce((total, row) => total + row.productCount, 0);
  const requestedProducts = scopeType === "ALL" ? configuredProductCount : count;
  const estimateScope = scopeType === "ALL" ? { type: "ALL" as const }
    : scopeType === "DEPARTMENT" ? { type: "DEPARTMENT" as const, departmentKey }
      : { type: "CATEGORY" as const, category };
  const estimateSeed = `${catalog.slug}:${catalog.nextProductSequence}:${requestedProducts}:${JSON.stringify(estimateScope)}:${colorVariantCount}`;
  const canContinueScope = scopeType === "ALL" ? catalog.assortmentPlan.length > 0 : (scopeType === "DEPARTMENT" ? Boolean(departmentKey) : Boolean(category));
  const estimatePlan = requestedProducts > 0 && canContinueScope && catalog.assortmentPlan.length > 0 ? planAssortment({
    sequences: Array.from({ length: requestedProducts }, (_, index) => catalog.nextProductSequence + index),
    scope: estimateScope,
    config: { departments: catalog.departments, assortmentPlan: catalog.assortmentPlan },
    seed: estimateSeed,
  }) : [];
  const generationEstimate = estimateAssortmentOutput({
    plan: estimatePlan,
    colorVariantCount,
    categorySizeCounts: catalog.categorySizeCounts,
  });
  const estimate = { ...generationEstimate, images: 0, liteLlmCalls: generationEstimate.products };
  const isLarge = requestedProducts >= catalog.largeJobThreshold;
  const mixDepartments = Array.from(new Set(catalog.assortmentPlan.map((row) => row.departmentKey)));
  const mixCategories = Array.from(new Set(catalog.assortmentPlan.map((row) => row.category)));
  const groupedMix = catalog.assortmentPlan.reduce<Record<string, Array<{ category: string; subcategory: string; productCount: number }>>>((groups, row) => {
    (groups[row.departmentKey] ??= []).push(row);
    return groups;
  }, {});

  async function submit() {
    if (!catalog || (isLarge && !confirmed)) return;
    setLoading(true);
    setError(null);
    const scope = scopeType === "ALL" ? { type: "ALL" as const }
      : scopeType === "DEPARTMENT" ? { type: "DEPARTMENT" as const, departmentKey }
        : { type: "CATEGORY" as const, category };
    const result = await createCatalogGenerationJobAction({ catalogId: catalog.id, ...(scopeType !== "ALL" && { requestedProducts: count }), colorVariantCount, scope });
    setLoading(false);
    if (!result.ok || result.jobId == null) {
      setError(result.message ?? "Could not queue the generation job");
      return;
    }
    onCreated(result.jobId);
  }

  return (
    <Modal isOpen onClose={onClose} title={`Generate catalogue information for ${catalog.name}`} size="lg">
      <div className="mb-6 grid grid-cols-3 gap-2" aria-label="Generation steps">
        {["Scope", "Output", "Review"].map((label, index) => <div key={label} className={`rounded-xl border px-3 py-2 text-center text-sm ${step === index ? "border-primary bg-white/70 font-semibold text-primary" : "border-white/65 text-[#1a1a1a]/55"}`}>{index + 1}. {label}</div>)}
      </div>
      {step === 0 && <div className="space-y-5">
        <Card title="All catalogue" description="Generate the configured product count from the catalogue mix."><Button variant={scopeType === "ALL" ? "primary" : "secondary"} onClick={() => setScopeType("ALL")}>All catalogue</Button></Card>
        {catalog.assortmentPlan.length === 0 && <NoticeBox variant="warning">Configure at least one valid catalogue mix row in Settings before queueing generation.</NoticeBox>}
        <Card title="Specific department" description="Every generated product will use this department.">
          <div className="flex gap-3"><Button variant={scopeType === "DEPARTMENT" ? "primary" : "secondary"} onClick={() => setScopeType("DEPARTMENT")}>Choose department</Button>{scopeType === "DEPARTMENT" && <FormSelect label="Department" value={departmentKey} onChange={(event) => setDepartmentKey(event.target.value)} options={catalog.departments.filter((item) => mixDepartments.includes(item.key)).map((item) => ({ value: item.key, label: item.label }))} />}</div>
        </Card>
        <Card title="Specific category" description="Products are distributed across the configured department and subcategory rows for this category.">
          <div className="flex gap-3"><Button variant={scopeType === "CATEGORY" ? "primary" : "secondary"} onClick={() => setScopeType("CATEGORY")}>Choose category</Button>{scopeType === "CATEGORY" && <FormSelect label="Category" value={category} onChange={(event) => setCategory(event.target.value)} options={mixCategories.map((value) => ({ value, label: value }))} />}</div>
        </Card>
      </div>}
      {step === 1 && <div className="space-y-5">
        {scopeType === "ALL" ? <Card title={`Catalogue mix · ${configuredProductCount} products`} description="All Catalogue uses the product counts configured in Settings. This number cannot be changed in the wizard." /> : <FormInput id="catalog-product-count" label="Number of products" type="number" min={1} max={catalog.maxProductsPerJob} value={count} onChange={(event) => setCount(Number(event.target.value))} helpText={`Products are parent records. Maximum ${catalog.maxProductsPerJob} products per job.`} />}
        <FormSelect id="catalog-color-variants" label="Color variants per product" value={String(colorVariantCount)} onChange={(event) => setColorVariantCount(Number(event.target.value) as 2 | 3)} options={[{ value: "2", label: "2 colors" }, { value: "3", label: "3 colors" }]} helpText="One text call creates product copy shared by all styles. This step creates sizes and stock, but no images." />
      </div>}
      {step === 2 && <div className="space-y-5">
        <Card title="Request summary" description={scopeType === "ALL" ? "All catalogue" : scopeType === "DEPARTMENT" ? `Department: ${catalog.departments.find((item) => item.key === departmentKey)?.label ?? departmentKey}` : `Category: ${category}`}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{[["Parent products", estimate.products], ["Color styles", estimate.styles], ["Images", estimate.images], ["Size rows", estimate.sizeRows], ["Attributed LiteLLM calls", estimate.liteLlmCalls]].map(([label, value]) => <div key={label} className="rounded-xl border border-white/70 bg-white/30 p-3"><p className="text-xl font-bold">{value}</p><p className="text-xs text-[#1a1a1a]/55">{label}</p></div>)}</div>
          <p className="mt-4 text-xs text-[#1a1a1a]/55">This step generates catalogue information only. Image generation is a separate manual step after these products are ready.</p>
        </Card>
        {scopeType === "ALL" && <Card title="Configured catalogue mix" description="The job will create exactly these base-product quotas."><div className="space-y-2">{Object.entries(groupedMix).map(([department, rows]) => <div key={department}><p className="font-semibold">{catalog.departments.find((item) => item.key === department)?.label ?? department}</p><ul className="ml-4 list-disc text-sm text-[#1a1a1a]/65">{rows.map((row) => <li key={`${department}:${row.category}:${row.subcategory}`}>{row.category} · {row.subcategory}: {row.productCount}</li>)}</ul></div>)}</div></Card>}
        {isLarge && <NoticeBox variant="warning" title="Large generation job"><FormCheckbox id="confirm-large-catalog-job" label={`I confirm ${estimate.products} products, ${estimate.styles} styles, no images, and ${estimate.liteLlmCalls} attributed LiteLLM calls`} checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} helpText="The job is queued for background processing." /></NoticeBox>}
      </div>}
      {error && <div className="mt-5"><NoticeBox variant="error">{error}</NoticeBox></div>}
      <div className="mt-6 flex justify-between gap-3">
        <Button variant="ghost" onClick={step === 0 ? onClose : () => setStep((value) => value - 1)} disabled={loading}>{step === 0 ? "Cancel" : "Back"}</Button>
        {step < 2 ? <Button onClick={() => setStep((value) => value + 1)} disabled={(step === 0 && !canContinueScope) || (step === 1 && (requestedProducts < 1 || requestedProducts > catalog.maxProductsPerJob))}>Continue</Button> : <Button onClick={() => void submit()} loading={loading} disabled={requestedProducts < 1 || requestedProducts > catalog.maxProductsPerJob || (isLarge && !confirmed)}>Generate catalogue information</Button>}
      </div>
    </Modal>
  );
}
