"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import FormCheckbox from "@/components/ui/form/FormCheckbox";
import FormInput from "@/components/ui/form/FormInput";
import FormSelect from "@/components/ui/form/FormSelect";
import Modal from "@/components/ui/modal/Modal";
import NoticeBox from "@/components/ui/NoticeBox";
import { createCatalogGenerationJobAction } from "@/modules/synthetic_catalog/server/admin-actions";

interface AddProductsModalProps {
  catalog: {
    id: number;
    name: string;
    estimatedSizesPerProduct: number;
    maxProductsPerJob: number;
    largeJobThreshold: number;
  } | null;
  onClose: () => void;
  onCreated: (jobId: number) => void;
}

export default function AddProductsModal({ catalog, onClose, onCreated }: AddProductsModalProps) {
  const [count, setCount] = useState(5);
  const [departmentMode, setDepartmentMode] = useState("AUTO");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!catalog) return null;
  const isLarge = count >= catalog.largeJobThreshold;
  const estimatedImages = Math.max(0, count) * 3;
  const estimatedVariants = Math.max(0, count) * catalog.estimatedSizesPerProduct;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!catalog || (isLarge && !confirmed)) return;
    setLoading(true);
    setError(null);
    const result = await createCatalogGenerationJobAction({
      catalogId: catalog.id,
      requestedProducts: count,
      departmentMode,
    });
    setLoading(false);
    if (!result.ok || result.jobId == null) {
      setError(result.message ?? "Could not queue the generation job");
      return;
    }
    onCreated(result.jobId);
  }

  return (
    <Modal isOpen onClose={onClose} title={`Add products to ${catalog.name}`} size="md">
      <form className="space-y-6" onSubmit={submit}>
        <FormInput
          id="catalog-product-count"
          label="Number of products"
          type="number"
          min={1}
          max={catalog.maxProductsPerJob}
          value={count}
          onChange={(event) => {
            setCount(Number(event.target.value));
            setConfirmed(false);
          }}
          helpText={`One style and three image views are generated for each product. Maximum ${catalog.maxProductsPerJob} products per job.`}
        />
        <FormSelect
          id="catalog-department"
          label="Department"
          value={departmentMode}
          onChange={(event) => setDepartmentMode(event.target.value)}
          options={[
            { value: "AUTO", label: "Automatic catalog mix" },
            { value: "WOMEN", label: "Women only" },
            { value: "MEN", label: "Men only" },
          ]}
        />
        <NoticeBox variant="info" title="Expected output">
          {count || 0} products, {count || 0} styles, {estimatedImages} generated images, and up to {estimatedVariants}{" "}
          variant rows. Generation runs in the background and may take several minutes.
        </NoticeBox>
        {isLarge && (
          <NoticeBox variant="warning" title="Large generation job">
            <FormCheckbox
              id="confirm-large-catalog-job"
              label={`I confirm this job will make ${count * 4} attributed LiteLLM calls`}
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              helpText="Each product uses one text call and three image calls."
            />
          </NoticeBox>
        )}
        {error && <NoticeBox variant="error">{error}</NoticeBox>}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" loading={loading} disabled={count < 1 || count > catalog.maxProductsPerJob || (isLarge && !confirmed)}>
            Queue generation
          </Button>
        </div>
      </form>
    </Modal>
  );
}
