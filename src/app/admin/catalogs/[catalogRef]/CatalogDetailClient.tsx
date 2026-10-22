"use client";

import { useRouter } from "next/navigation";
import { Fragment } from "react";
import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import FormInput from "@/components/ui/form/FormInput";
import FormSelect from "@/components/ui/form/FormSelect";
import FormTextarea from "@/components/ui/form/FormTextarea";
import Icon from "@/components/ui/Icon";
import NoticeBox from "@/components/ui/NoticeBox";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import type {
  CatalogDetailView,
  CatalogJobView,
} from "@/modules/synthetic_catalog/admin/types";
import { CATALOG_IMAGE_MODEL_OPTIONS, OUTFIT_SLOTS } from "@/modules/synthetic_catalog/config/profiles";
import {
  getCatalogDetailAction,
  getCatalogExportSummaryAction,
  getCoreImagesPreflightAction,
  addCatalogTaxonomyAction,
  cancelCatalogGenerationJobAction,
  createCoreImagesJobAction,
  retryCatalogGenerationJobAction,
  saveCatalogMixAction,
  updateCatalogSettingsAction,
} from "@/modules/synthetic_catalog/server/admin-actions";
import type { CatalogExportSummary } from "@/modules/synthetic_catalog/export/demoware-csv";
import AddProductsModal from "../AddProductsModal";
import CatalogStatusBadge from "../CatalogStatusBadge";
import DownloadCsvButton, { DownloadValidationReportButton } from "../DownloadCsvButton";
import ProductTable from "./ProductTable";

const ACTIVE_STATUSES = new Set(["QUEUED", "RUNNING"]);

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function JobProgress({ job }: { job: CatalogJobView }) {
  const expectedProducts = job.requestedProducts;
  const expectedImages = job.jobType === "REGENERATE_IMAGE" ? 1 : job.jobType === "CATALOG_INFO" ? 0 : job.jobType === "CORE_IMAGES" ? job.totalTasks : expectedProducts * job.colorVariantCount * 3;
  const settledProducts = job.completedProducts + job.failedProducts;
  const settledImages = job.completedImages + job.failedImages;
  const total = expectedProducts + expectedImages;
  const settled = settledProducts + settledImages;
  const percent = total === 0 ? 0 : Math.min(100, Math.round((settled / total) * 100));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-[#1a1a1a]">{job.stage.toLowerCase()}</span>
        <span className="text-[#1a1a1a]/60">{settled}/{total} tasks · {percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/55" aria-label={`${percent}% complete`}>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs text-[#1a1a1a]/60">
        <span>{job.jobType === "CATALOG_INFO" ? "Information-ready products" : "Products"}: {job.completedProducts}/{expectedProducts}</span>
        <span>Images: {job.completedImages}/{expectedImages}</span>
      </div>
    </div>
  );
}

function SettingsPanel({ detail, canEdit, onSaved }: { detail: CatalogDetailView; canEdit: boolean; onSaved: () => Promise<void> }) {
  const [brandName, setBrandName] = useState(detail.catalog.brandName);
  const [textModel, setTextModel] = useState(detail.catalog.defaultTextModel);
  const [imageModel, setImageModel] = useState(detail.catalog.defaultImageModel);
  const [visualDirection, setVisualDirection] = useState(detail.catalog.visualDirection);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [departmentLabel, setDepartmentLabel] = useState("");
  const [departmentCode, setDepartmentCode] = useState("");
  const [departmentWeight, setDepartmentWeight] = useState("0.1");
  const [newCategory, setNewCategory] = useState("");
  const [newCategorySubcategory, setNewCategorySubcategory] = useState("");
  const [existingCategory, setExistingCategory] = useState(detail.catalog.categories[0] ?? "");
  const [newSubcategory, setNewSubcategory] = useState("");
  const [mixRows, setMixRows] = useState(detail.catalog.assortmentPlan);
  const [mixBusy, setMixBusy] = useState(false);
  const [mixMessage, setMixMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const { confirm } = useConfirm();

  function mixRowError(index: number): string | null {
    const row = mixRows[index];
    if (!row) return null;
    if (!detail.catalog.departments.some((department) => department.key === row.departmentKey)) return "Choose a configured department.";
    if (!row.category.trim()) return "Category is required.";
    if (!row.subcategory.trim()) return "Subcategory is required.";
    if (!OUTFIT_SLOTS.includes(row.outfitSlot as typeof OUTFIT_SLOTS[number])) return "Choose an outfit slot.";
    if (!Number.isSafeInteger(row.productCount) || row.productCount < 1) return "Product count must be a positive integer.";
    const tuple = [row.departmentKey, row.category, row.subcategory].map((value) => value.trim().toLocaleLowerCase()).join("\u0000");
    if (mixRows.some((candidate, candidateIndex) => candidateIndex !== index && [candidate.departmentKey, candidate.category, candidate.subcategory].map((value) => value.trim().toLocaleLowerCase()).join("\u0000") === tuple)) return "This mix row already exists.";
    return null;
  }

  async function saveMix() {
    setMixBusy(true);
    setMixMessage(null);
    const result = await saveCatalogMixAction({ catalogId: detail.catalog.id, rows: mixRows });
    setMixBusy(false);
    if (!result.ok) {
      setMixMessage({ kind: "error", text: result.message ?? "Could not save catalogue mix" });
      return;
    }
    setMixMessage({ kind: "success", text: "Catalogue mix saved for future jobs" });
    await onSaved();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await updateCatalogSettingsAction({
      catalogId: detail.catalog.id,
      brandName,
      defaultTextModel: textModel,
      defaultImageModel: imageModel,
      visualDirection,
    });
    setBusy(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.message ?? "Could not save catalog settings" });
      return;
    }
    setMessage({ kind: "success", text: "Catalog settings saved" });
    await onSaved();
  }

  async function addTaxonomy(input: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    const result = await addCatalogTaxonomyAction(input);
    setBusy(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.message ?? "Could not update catalog taxonomy" });
      return;
    }
    setMessage({ kind: "success", text: "Taxonomy item added" });
    await onSaved();
  }

  return (
    <div className="space-y-6"><Card title="Generation settings" description="Defaults apply to newly queued jobs; existing jobs retain their stored models.">
      <form className="space-y-5" onSubmit={submit}>
        <FormInput id="catalog-brand" label="Brand name" value={brandName} onChange={(event) => setBrandName(event.target.value)} disabled={!canEdit} />
        <div className="grid gap-5 md:grid-cols-2">
          <FormInput id="catalog-text-model" label="LiteLLM text model" value={textModel} onChange={(event) => setTextModel(event.target.value)} disabled={!canEdit} helpText="Use the provider/model name configured on LiteLLM." />
          <FormSelect id="catalog-image-model" label="LiteLLM image model" value={imageModel} onChange={(event) => setImageModel(event.target.value)} disabled={!canEdit} options={CATALOG_IMAGE_MODEL_OPTIONS.map((model) => ({ value: model, label: model }))} helpText="Only the app's reviewed image-capable LiteLLM models are offered." />
        </div>
        <FormTextarea id="catalog-visual-direction" label="Visual direction" rows={5} value={visualDirection} onChange={(event) => setVisualDirection(event.target.value)} disabled={!canEdit} />
        {message && <NoticeBox variant={message.kind}>{message.text}</NoticeBox>}
        {canEdit && <div className="flex justify-end"><Button type="submit" loading={busy}><Icon type="save" size="sm" /> Save settings</Button></div>}
      </form>
    </Card>
    <Card title="Catalog taxonomy" description="Add-only settings. Existing product identifiers and queued jobs keep their saved values.">
      {canEdit ? <div className="grid gap-6 xl:grid-cols-3">
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void addTaxonomy({ type: "DEPARTMENT", catalogId: detail.catalog.id, label: departmentLabel, code: departmentCode, generationWeight: Number(departmentWeight) }); }}>
          <h4 className="font-semibold">Add department</h4>
          <FormInput id="tax-department-label" label="Label" value={departmentLabel} disabled={!canEdit} onChange={(event) => setDepartmentLabel(event.target.value)} />
          <FormInput id="tax-department-code" label="Product ID code" value={departmentCode} disabled={!canEdit} onChange={(event) => setDepartmentCode(event.target.value)} helpText="1–6 uppercase letters or digits." />
          <FormInput id="tax-department-weight" label="Generation weight" type="number" min="0.01" step="0.01" value={departmentWeight} disabled={!canEdit} onChange={(event) => setDepartmentWeight(event.target.value)} />
          {canEdit && <Button type="submit" loading={busy}>Add department</Button>}
        </form>
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void addTaxonomy({ type: "CATEGORY", catalogId: detail.catalog.id, category: newCategory, subcategory: newCategorySubcategory }); }}>
          <h4 className="font-semibold">Add category</h4>
          <FormInput id="tax-category" label="Category" value={newCategory} disabled={!canEdit} onChange={(event) => setNewCategory(event.target.value)} />
          <FormInput id="tax-first-subcategory" label="First subcategory" value={newCategorySubcategory} disabled={!canEdit} onChange={(event) => setNewCategorySubcategory(event.target.value)} />
          {canEdit && <Button type="submit" loading={busy}>Add category</Button>}
        </form>
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void addTaxonomy({ type: "SUBCATEGORY", catalogId: detail.catalog.id, category: existingCategory, subcategory: newSubcategory }); }}>
          <h4 className="font-semibold">Add subcategory</h4>
          <FormSelect id="tax-existing-category" label="Category" value={existingCategory} disabled={!canEdit} onChange={(event) => setExistingCategory(event.target.value)} options={detail.catalog.categories.map((value) => ({ value, label: value }))} />
          <FormInput id="tax-subcategory" label="Subcategory" value={newSubcategory} disabled={!canEdit} onChange={(event) => setNewSubcategory(event.target.value)} />
          {canEdit && <Button type="submit" loading={busy}>Add subcategory</Button>}
        </form>
      </div> : <p className="text-sm text-[#1a1a1a]/55">You have read-only access to catalog taxonomy.</p>}
      {message && <div className="mt-4"><NoticeBox variant={message.kind}>{message.text}</NoticeBox></div>}
      <div className="mt-6 grid gap-4 md:grid-cols-3"><div><p className="text-sm font-semibold">Departments</p><ul className="mt-2 list-disc pl-5 text-sm">{detail.catalog.departments.map((item) => <li key={item.key}>{item.label} · {item.code} · weight {item.generationWeight}</li>)}</ul></div><div><p className="text-sm font-semibold">Categories</p><ul className="mt-2 list-disc pl-5 text-sm">{detail.catalog.categories.map((item) => <li key={item}>{item}</li>)}</ul></div><div><p className="text-sm font-semibold">Subcategories</p><ul className="mt-2 list-disc pl-5 text-sm">{Object.entries(detail.catalog.subcategories).map(([key, values]) => <li key={key}>{key}: {values.join(", ")}</li>)}</ul></div></div>
    </Card>
    <Card title="Catalogue mix" description="Each row defines an allowed department, category, and subcategory combination and its exact All Catalogue quota. Edits only affect future jobs.">
      <div className="space-y-3">
        <div className="ds-table-shell overflow-hidden"><div className="overflow-x-auto"><table className="w-full">
          <thead className="ds-table-head"><tr>{["Department", "Category", "Subcategory", "Products", "Outfit slot", ...(canEdit ? ["Actions"] : [])].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1a1a1a]/55">{heading}</th>)}</tr></thead>
          <tbody>{mixRows.map((row, index) => <Fragment key={`${index}:${row.departmentKey}:${row.category}`}>
            <tr className="ds-table-row">
              <td className="min-w-48 px-3 py-2"><FormSelect label="Department" value={row.departmentKey} disabled={!canEdit || mixBusy} onChange={(event) => setMixRows((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, departmentKey: event.target.value } : item))} options={detail.catalog.departments.map((item) => ({ value: item.key, label: item.label }))} /></td>
              <td className="min-w-48 px-3 py-2"><FormInput label="Category" value={row.category} disabled={!canEdit || mixBusy} onChange={(event) => setMixRows((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, category: event.target.value } : item))} /></td>
              <td className="min-w-48 px-3 py-2"><FormInput label="Subcategory" value={row.subcategory} disabled={!canEdit || mixBusy} onChange={(event) => setMixRows((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, subcategory: event.target.value } : item))} /></td>
              <td className="w-32 px-3 py-2"><FormInput label="Products" type="number" min="1" step="1" value={String(row.productCount)} disabled={!canEdit || mixBusy} onChange={(event) => setMixRows((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, productCount: Number(event.target.value) } : item))} /></td>
              <td className="min-w-40 px-3 py-2"><FormSelect label="Outfit slot" value={row.outfitSlot} disabled={!canEdit || mixBusy} onChange={(event) => setMixRows((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, outfitSlot: event.target.value } : item))} options={[{ value: "", label: "Choose outfit slot" }, ...OUTFIT_SLOTS.map((slot) => ({ value: slot, label: slot.replaceAll("_", " ") }))]} /></td>
              {canEdit && <td className="px-3 py-2 text-right"><Button type="button" variant="danger" size="sm" disabled={mixBusy} onClick={async () => {
                const confirmed = await confirm({ title: "Remove catalogue mix row?", message: "This only changes future generation. Existing products remain unchanged.", confirmText: "Remove row", variant: "danger" });
                if (confirmed) setMixRows((items) => items.filter((_, itemIndex) => itemIndex !== index));
              }}>Remove</Button></td>}
            </tr>
            {mixRowError(index) && <tr><td colSpan={canEdit ? 6 : 5} className="px-4 py-2 text-sm text-danger" role="alert">{mixRowError(index)}</td></tr>}
          </Fragment>)}</tbody>
        </table></div></div>
        {!canEdit && mixRows.length === 0 && <p className="text-sm text-[#1a1a1a]/55">No catalogue mix rows are configured.</p>}
        {mixRows.length === 0 && <NoticeBox variant="error">At least one catalogue mix row is required.</NoticeBox>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold">All Catalogue total: {mixRows.reduce((total, row) => total + (Number.isSafeInteger(row.productCount) && row.productCount > 0 ? row.productCount : 0), 0)} products</p>
          {canEdit && <div className="flex gap-2"><Button type="button" variant="secondary" disabled={mixBusy || detail.catalog.departments.length === 0} onClick={() => setMixRows((items) => [...items, { departmentKey: detail.catalog.departments[0]?.key ?? "", category: "", subcategory: "", productCount: 1, outfitSlot: "" }])}><Icon type="plus" size="sm" /> Add row</Button><Button type="button" loading={mixBusy} disabled={mixRows.length === 0 || mixRows.some((_, index) => mixRowError(index) != null)} onClick={() => void saveMix()}><Icon type="save" size="sm" /> Save catalogue mix</Button></div>}
        </div>
        {mixMessage && <NoticeBox variant={mixMessage.kind}>{mixMessage.text}</NoticeBox>}
        {canEdit && mixRows.some((row) => !detail.catalog.categories.some((category) => category.toLocaleLowerCase() === row.category.trim().toLocaleLowerCase())) && <NoticeBox variant="info">Saving a row adds its category and subcategory to catalogue taxonomy.</NoticeBox>}
        {detail.catalog.categories.some((category) => !mixRows.some((row) => row.category.toLocaleLowerCase() === category.toLocaleLowerCase())) && <NoticeBox variant="warning" title="Taxonomy needs a mix row">Some categories are not assigned to any department and subcategory combination. Add explicit rows before generating products in those categories.</NoticeBox>}
      </div>
    </Card>
    </div>
  );
}

export default function CatalogDetailClient({
  initialDetail,
  initialExportSummary,
  canEdit,
}: {
  initialDetail: CatalogDetailView;
  initialExportSummary: CatalogExportSummary | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [detail, setDetail] = useState(initialDetail);
  const [exportSummary, setExportSummary] = useState(initialExportSummary);
  const [showAdd, setShowAdd] = useState(false);
  const [busyJobId, setBusyJobId] = useState<number | null>(null);
  const [coreBusy, setCoreBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const hasActiveJob = detail.jobs.some((job) => ACTIVE_STATUSES.has(job.status));

  const refresh = useCallback(async () => {
    const [next, nextSummary] = await Promise.all([
      getCatalogDetailAction(detail.catalog.slug),
      getCatalogExportSummaryAction(detail.catalog.slug),
    ]);
    if (next) setDetail(next);
    if (nextSummary) setExportSummary(nextSummary);
  }, [detail.catalog.slug]);

  useEffect(() => {
    if (!hasActiveJob) return;
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [hasActiveJob, refresh]);

  async function retry(jobId: number) {
    setBusyJobId(jobId);
    setError(null);
    const result = await retryCatalogGenerationJobAction(jobId);
    setBusyJobId(null);
    if (!result.ok) setError(result.message ?? "Could not retry generation job");
    await refresh();
  }

  async function startCoreImages(sourceJobId?: number, allMissing = false) {
    setCoreBusy(true);
    setError(null);
    const preflight = await getCoreImagesPreflightAction({ catalogId: detail.catalog.id, sourceJobId, allMissing });
    if (!preflight.ok) {
      setCoreBusy(false);
      setError(preflight.message);
      return;
    }
    if (preflight.expectedImages === 0) {
      setCoreBusy(false);
      setSuccess("Every target style already has its required core images.");
      return;
    }
    const accepted = await confirm({
      title: "Generate core images?",
      message: `This targets ${preflight.products} products and ${preflight.styles} colour styles, with ${preflight.expectedImages} image calls. Each style gets FRONT, BACK, and ON_MODEL images.`,
      confirmText: "Queue core images",
    });
    if (!accepted) {
      setCoreBusy(false);
      return;
    }
    const result = await createCoreImagesJobAction({ catalogId: detail.catalog.id, sourceJobId, allMissing });
    setCoreBusy(false);
    if (!result.ok) setError(result.message ?? "Could not queue core image generation");
    else setSuccess("Core image generation queued. Each colour style receives FRONT, BACK, and ON_MODEL images.");
    await refresh();
  }

  async function stop(job: CatalogJobView) {
    const confirmed = await confirm({
      title: "Stop generation?",
      message: "Stopping prevents further work. A provider request that has already started may finish and incur its cost.",
      confirmText: "Stop generation",
      variant: "danger",
    });
    if (!confirmed) return;
    setBusyJobId(job.id);
    setError(null);
    setSuccess(null);
    const result = await cancelCatalogGenerationJobAction(job.id);
    setBusyJobId(null);
    if (result.ok) setSuccess("Generation stopped. Completed products and images were preserved.");
    else setError(result.message ?? "Could not stop generation job");
    await refresh();
  }

  const activeJobs = detail.jobs.filter((job) => ACTIVE_STATUSES.has(job.status));
  const tabs = [
    {
      id: "products",
      label: `Products (${detail.counts.products})`,
      icon: <Icon type="fashion" size="sm" />,
      content: (
        <ProductTable
          catalogSlug={detail.catalog.slug}
          products={detail.products}
          canEdit={canEdit}
          onAddProducts={() => setShowAdd(true)}
          onArchiveChanged={refresh}
        />
      ),
    },
    {
      id: "jobs",
      label: `Jobs (${detail.jobs.length})`,
      icon: <Icon type="clock" size="sm" />,
      content: <div className="mt-6 space-y-4">{detail.jobs.map((job) => (
        <Card key={job.id} title={`${job.jobType.toLowerCase().replaceAll("_", " ")} · ${formatDate(job.createdAt)}`} headerActions={<CatalogStatusBadge status={job.status} />}>
          <JobProgress job={job} />
          {(job.errorMessage || job.failedTaskDetails.length > 0) && (
            <NoticeBox variant="error" title="Generation failures">
              {job.errorMessage && <p>{job.errorMessage}</p>}
              {job.failedTaskDetails.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {job.failedTaskDetails.slice(0, 8).map((task) => (
                    <li key={task.id}>
                      <span className="font-medium">
                        {task.taskType.toLowerCase().replaceAll("_", " ")} · {task.reference}
                      </span>{" "}
                      (attempt {task.attempts}/{task.maxAttempts}): {task.lastError}
                    </li>
                  ))}
                </ul>
              )}
              {job.failedTaskDetails.length > 8 && (
                <p className="mt-2">Plus {job.failedTaskDetails.length - 8} more failed task(s).</p>
              )}
              {canEdit && (
                <p className="mt-2">
                  Retry failures requeues only failed tasks and preserves completed products and images.
                </p>
              )}
            </NoticeBox>
          )}
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-xs text-[#1a1a1a]/55">Scope: {job.scopeType === "LEGACY" ? job.departmentMode.toLowerCase() : job.scopeType === "ALL" ? "all catalogue" : `${job.scopeType.toLowerCase()}: ${job.scopeValue ?? ""}`} · {job.colorVariantCount} color(s) per product · Job {job.publicId}</p>
            <div className="flex gap-2">
              {canEdit && (job.status === "QUEUED" || job.status === "RUNNING") && <Button variant="danger" size="sm" loading={busyJobId === job.id} onClick={() => void stop(job)}><Icon type="warning" size="sm" /> Stop</Button>}
              {canEdit && (job.status === "FAILED" || job.status === "COMPLETED_WITH_ERRORS") && <Button variant="secondary" size="sm" loading={busyJobId === job.id} onClick={() => void retry(job.id)}><Icon type="refresh" size="sm" /> Retry failures</Button>}
            </div>
          </div>
        </Card>
      ))}</div>,
    },
    {
      id: "export",
      label: "Export",
      icon: <Icon type="download" size="sm" />,
      content: exportSummary ? (
        <div className="mt-6 space-y-6">
          <Card
            title="Catalogue CSV"
            description="One row per variant, with front, back, and on-model image URLs in deterministic order."
            headerActions={
              <div className="flex gap-2">
                <DownloadValidationReportButton catalogSlug={detail.catalog.slug} />
                <DownloadCsvButton catalogSlug={detail.catalog.slug} disabled={exportSummary.variantsExported === 0} />
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {[
                ["Products exported", exportSummary.productsExported],
                ["Styles exported", exportSummary.stylesExported],
                ["Variant rows", exportSummary.variantsExported],
                ["Images referenced", exportSummary.imagesReferenced],
                ["Products excluded", exportSummary.incompleteProductsExcluded],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/70 bg-white/30 p-4 text-center">
                  <p className="text-2xl font-bold text-[#1a1a1a]">{value}</p>
                  <p className="text-xs font-medium text-[#1a1a1a]/55">{label}</p>
                </div>
              ))}
            </div>
          </Card>
          {!exportSummary.readyForImport ? (
            <NoticeBox variant="warning" title="Excluded product validation">
              {exportSummary.totalProducts === 0 ? (
                <p>Add and complete at least one product before exporting.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5">
                  {exportSummary.issues.slice(0, 10).map((issue, index) => (
                    <li key={`${issue.productId}-${issue.code}-${index}`}>
                      <span className="font-medium">{issue.productId}</span>: {issue.message}
                    </li>
                  ))}
                </ul>
              )}
              {exportSummary.issues.length > 10 && <p className="mt-2">Plus {exportSummary.issues.length - 10} more validation issue(s).</p>}
            </NoticeBox>
          ) : (
            <NoticeBox variant="success" title="Ready for export">All persisted products pass the Catalogue CSV export checks.</NoticeBox>
          )}
        </div>
      ) : (
        <EmptyState className="mt-6" icon="download" title="Export unavailable" description="The catalog export summary could not be loaded." />
      ),
    },
    {
      id: "settings",
      label: "Settings",
      icon: <Icon type="settings" size="sm" />,
      content: <div className="mt-6"><SettingsPanel detail={detail} canEdit={canEdit} onSaved={refresh} /></div>,
    },
  ];
  const latestInfoJob = detail.jobs.find((job) => job.jobType === "CATALOG_INFO" && (job.status === "COMPLETED" || job.status === "COMPLETED_WITH_ERRORS"));

  return (
    <div className="px-8 py-6 space-y-8">
      <PageHeader
        title={detail.catalog.name}
        description={`${detail.catalog.brandName} · ${detail.catalog.externalPrefix} · ${detail.catalog.segment}`}
        actions={<><Button variant="secondary" onClick={() => router.push("/admin/catalogs")}><Icon type="arrow-left" size="sm" /> All catalogs</Button>{canEdit && <Button onClick={() => setShowAdd(true)}><Icon type="plus" size="sm" /> Generate catalogue information</Button>}</>}
      />
      {error && <NoticeBox variant="error">{error}</NoticeBox>}
      {success && <NoticeBox variant="success">{success}</NoticeBox>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ["Products", detail.counts.products],
          ["Styles", detail.counts.styles],
          ["Variants", detail.counts.variants],
          ["Ready images", detail.counts.readyImages],
          ["Failed images", detail.counts.failedImages],
        ].map(([label, value]) => <Card key={label} className="text-center"><p className="text-3xl font-bold text-[#1a1a1a]">{value}</p><p className="text-xs font-medium text-[#1a1a1a]/55">{label}</p></Card>)}
      </div>
      <Card title="Manual catalogue workflow" description="Run each stage when you are ready. Catalogue information creates no images.">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/70 bg-white/30 p-4"><p className="text-xs font-semibold uppercase text-[#1a1a1a]/55">Step 1</p><p className="mt-1 font-semibold">Catalogue information</p><p className="mt-2 text-sm text-[#1a1a1a]/65">Generate products, colour styles, and size/inventory rows.</p>{canEdit && <Button className="mt-3" size="sm" onClick={() => setShowAdd(true)}><Icon type="plus" size="sm" /> Generate information</Button>}</div>
          <div className="rounded-xl border border-white/70 bg-white/30 p-4"><p className="text-xs font-semibold uppercase text-[#1a1a1a]/55">Step 2</p><p className="mt-1 font-semibold">Core images</p><p className="mt-2 text-sm text-[#1a1a1a]/65">Three images per colour style: FRONT, BACK, and ON_MODEL.</p>{canEdit && <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" loading={coreBusy} disabled={!latestInfoJob} onClick={() => latestInfoJob && void startCoreImages(latestInfoJob.id)}>{latestInfoJob ? "Generate batch core images" : "Waiting for Step 1"}</Button><Button variant="secondary" size="sm" loading={coreBusy} onClick={() => void startCoreImages(undefined, true)}>All products missing core images</Button></div>}</div>
          <div className="rounded-xl border border-white/70 bg-white/30 p-4"><p className="text-xs font-semibold uppercase text-[#1a1a1a]/55">Step 3</p><p className="mt-1 font-semibold">Complete the Look</p><p className="mt-2 text-sm text-[#1a1a1a]/65">Optional outfit images and companion-product recommendations.</p><p className="mt-3 text-xs text-[#1a1a1a]/55">Available after core imagery is ready across the catalogue.</p></div>
        </div>
      </Card>
      {activeJobs.map((job) => <Card key={job.id} title="Generation in progress" description={`Job ${job.publicId}`} headerActions={<CatalogStatusBadge status={job.status} />}><JobProgress job={job} /></Card>)}
      <Tabs tabs={tabs} defaultTab="products" />
      <AddProductsModal key={showAdd ? detail.catalog.id : "closed"} catalog={showAdd ? detail.catalog : null} onClose={() => setShowAdd(false)} onCreated={async () => { setShowAdd(false); await refresh(); }} />
    </div>
  );
}
