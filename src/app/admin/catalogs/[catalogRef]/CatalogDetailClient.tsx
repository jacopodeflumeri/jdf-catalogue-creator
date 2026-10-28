"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
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
import Modal from "@/components/ui/modal/Modal";
import CollapsibleCard from "@/components/ui/CollapsibleCard";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import type {
  CatalogDetailView,
  CatalogJobView,
} from "@/modules/synthetic_catalog/admin/types";
import { CATALOG_IMAGE_MODEL_OPTIONS } from "@/modules/synthetic_catalog/config/profiles";
import {
  getCatalogDetailAction,
  getCatalogExportSummaryAction,
  getCompleteLookExportSummaryAction,
  getCoreImagesPreflightAction,
  getCompleteLookPreflightAction,
  addCatalogTaxonomyAction,
  cancelCatalogGenerationJobAction,
  createCompleteLookJobAction,
  createCoreImagesJobAction,
  retryCatalogGenerationJobAction,
  updateCatalogSettingsAction,
  deleteFullCatalogAction,
  getCatalogDeletionSummaryAction,
} from "@/modules/synthetic_catalog/server/admin-actions";
import type { CatalogExportSummary } from "@/modules/synthetic_catalog/export/upc-csv";
import AddProductsModal from "../AddProductsModal";
import CatalogStatusBadge from "../CatalogStatusBadge";
import DownloadCsvButton, { DownloadCompleteLookCsvButton, DownloadValidationReportButton } from "../DownloadCsvButton";
import ProductTable from "./ProductTable";
import CatalogueMixEditor from "./CatalogueMixEditor";
import DesignMixEditor from "./DesignMixEditor";
import ManualCatalogWorkflow from "./ManualCatalogWorkflow";
import CatalogBrandLogo from "../CatalogBrandLogo";
import { coreImageActionInput, defaultCoreWorkflowTarget, type CoreWorkflowTarget } from "./workflow-targets";

const ACTIVE_STATUSES = new Set(["QUEUED", "RUNNING"]);

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function JobProgress({ job }: { job: CatalogJobView }) {
  if (job.jobType === "BULK_RENAME") {
    const settled = job.completedTasks + job.failedTasks;
    const percent = job.totalTasks === 0 ? 0 : Math.round(settled / job.totalTasks * 100);
    return <div className="space-y-3"><div className="flex items-center justify-between text-sm"><span className="font-medium">Name proposal progress</span><span>{settled}/{job.totalTasks} batches · {percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/55"><div className="h-full bg-primary" style={{ width: `${percent}%` }} /></div><p className="text-xs text-[#1a1a1a]/60">{job.requestedProducts} products requested · {job.completedTasks} proposal batches complete · {job.failedTasks} failed</p></div>;
  }
  const expectedProducts = job.jobType === "CATALOG_INFO" || job.jobType === "INITIAL" || job.jobType === "ADD_PRODUCTS" ? job.requestedProducts : 0;
  const expectedImages = job.jobType === "REGENERATE_IMAGE" ? 1 : job.jobType === "CATALOG_INFO" ? 0 : job.jobType === "CORE_IMAGES" || job.jobType === "COMPLETE_LOOK" ? job.totalTasks : expectedProducts * job.colorVariantCount * 3;
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
        {job.jobType === "CATALOG_INFO" && <span>Information-ready styles: {job.informationReadyStyles}</span>}
        {job.jobType === "COMPLETE_LOOK" && <span>Skipped styles: {job.skippedImages}</span>}
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
    <div className="space-y-6"><CollapsibleCard title="Generation settings" description="Defaults apply to newly queued jobs; existing jobs retain their stored models.">
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
    </CollapsibleCard>
    <CollapsibleCard title="Departments" description="Departments keep stable keys, labels, and product ID codes.">
      {canEdit ? <div className="grid gap-6 xl:grid-cols-3">
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void addTaxonomy({ type: "DEPARTMENT", catalogId: detail.catalog.id, label: departmentLabel, code: departmentCode }); }}>
          <h4 className="font-semibold">Add department</h4>
          <FormInput id="tax-department-label" label="Label" value={departmentLabel} disabled={!canEdit} onChange={(event) => setDepartmentLabel(event.target.value)} />
          <FormInput id="tax-department-code" label="Product ID code" value={departmentCode} disabled={!canEdit} onChange={(event) => setDepartmentCode(event.target.value)} helpText="1–6 uppercase letters or digits." />
          {canEdit && <Button type="submit" loading={busy}>Add department</Button>}
        </form>
      </div> : <p className="text-sm text-[#1a1a1a]/55">You have read-only access to catalog taxonomy.</p>}
      {message && <div className="mt-4"><NoticeBox variant={message.kind}>{message.text}</NoticeBox></div>}
      <ul className="mt-6 grid gap-3 text-sm md:grid-cols-2">{detail.catalog.departments.map((item) => <li key={item.key} className="rounded-xl border border-white/60 bg-white/35 px-4 py-3">{item.label} · {item.key} · code {item.code}</li>)}</ul>
    </CollapsibleCard>
    <CatalogueMixEditor detail={detail} canEdit={canEdit} onSaved={onSaved} />
    <DesignMixEditor detail={detail} canEdit={canEdit} onSaved={onSaved} />
    </div>
  );
}

export default function CatalogDetailClient({
  initialDetail,
  initialExportSummary,
  initialCompleteLookExportSummary,
  canEdit,
  canDelete,
  initialSearch,
}: {
  initialDetail: CatalogDetailView;
  initialExportSummary: CatalogExportSummary | null;
  initialCompleteLookExportSummary: { rowCount: number } | null;
  canEdit: boolean;
  canDelete: boolean;
  initialSearch: string;
}) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [detail, setDetail] = useState(initialDetail);
  const [exportSummary, setExportSummary] = useState(initialExportSummary);
  const [completeLookExportSummary, setCompleteLookExportSummary] = useState(initialCompleteLookExportSummary);
  const [showAdd, setShowAdd] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteSummary, setDeleteSummary] = useState<Awaited<ReturnType<typeof getCatalogDeletionSummaryAction>>>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [busyJobId, setBusyJobId] = useState<number | null>(null);
  const [coreBusy, setCoreBusy] = useState(false);
  const [coreTarget, setCoreTarget] = useState<CoreWorkflowTarget | "latest">("latest");
  const [lookBusy, setLookBusy] = useState(false);
  const [lookTarget, setLookTarget] = useState("ALL");
  const [lookGateIssues, setLookGateIssues] = useState<Array<{ styleId: number; styleExternalId: string; productExternalId: string; missingRoles: string[]; failedRoles: string[] }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const hasActiveJob = detail.jobs.some((job) => ACTIVE_STATUSES.has(job.status));

  const refresh = useCallback(async () => {
    const [next, nextSummary, nextCompleteLookSummary] = await Promise.all([
      getCatalogDetailAction(detail.catalog.slug),
      getCatalogExportSummaryAction(detail.catalog.slug),
      getCompleteLookExportSummaryAction(detail.catalog.slug),
    ]);
    if (next) setDetail(next);
    if (nextSummary) setExportSummary(nextSummary);
    if (nextCompleteLookSummary) setCompleteLookExportSummary(nextCompleteLookSummary);
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

  async function openDeleteDialog() {
    const summary = await getCatalogDeletionSummaryAction(detail.catalog.id);
    if (!summary) { setError("Catalogue is no longer available"); return; }
    setDeleteSummary(summary); setDeleteConfirmation(""); setShowDelete(true);
  }

  async function deleteCatalog() {
    setDeleteBusy(true);
    const result = await deleteFullCatalogAction({ catalogId: detail.catalog.id, confirmation: deleteConfirmation });
    setDeleteBusy(false);
    if (!result.ok) { setError(result.message ?? "Could not delete catalogue"); return; }
    setShowDelete(false); router.push("/admin/catalogs"); router.refresh();
  }

  async function startCoreImages() {
    const target = coreImageActionInput(detail.catalog.id, selectedCoreTarget);
    if (!target) return;
    setCoreBusy(true);
    setError(null);
    const preflight = await getCoreImagesPreflightAction(target);
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
      message: `This targets ${preflight.products} products and ${preflight.styles} colour styles, with ${preflight.expectedImages} image calls. Each style gets FRONT and BACK images.`,
      confirmText: "Queue core images",
    });
    if (!accepted) {
      setCoreBusy(false);
      return;
    }
    const result = await createCoreImagesJobAction(target);
    setCoreBusy(false);
    if (!result.ok) setError(result.message ?? "Could not queue core image generation");
    else setSuccess("Core image generation queued. Each colour style receives FRONT and BACK images.");
    await refresh();
  }

  async function startCompleteLooks() {
    setLookBusy(true);
    setError(null);
    const sourceJobId = lookTarget === "ALL" ? undefined : Number(lookTarget);
    const preflight = await getCompleteLookPreflightAction({ catalogId: detail.catalog.id, sourceJobId });
    if (!preflight.ok) { setLookBusy(false); setError(preflight.message); return; }
    if (!preflight.gateReady) {
      setLookGateIssues(preflight.sampleReadinessFailures);
      const front = preflight.readinessFailures.filter((item) => item.missingRoles.includes("FRONT")).length;
      const back = preflight.readinessFailures.filter((item) => item.missingRoles.includes("BACK")).length;
      setLookBusy(false);
      setError(`Step 3 is blocked by the full-catalogue gate: ${front} styles need FRONT and ${back} need BACK. Use Step 2 with “All active products missing core images”.`);
      return;
    }
    setLookGateIssues([]);
    const summary = `${preflight.targetProducts} products, ${preflight.targetStyles} colour styles, ${preflight.eligibleStyles} eligible, ${preflight.skippedStyles} skipped, ${preflight.expectedImageCalls} image calls.`;
    const skipReasons = preflight.skipped.slice(0, 8).map((item) => `${item.style}: ${item.reason}`).join("\n");
    const accepted = await confirm({ title: "Generate Complete the Look images?", message: `${summary}${skipReasons ? `\nSkipped styles:\n${skipReasons}` : ""}`, confirmText: "Queue Complete the Look" });
    if (!accepted) { setLookBusy(false); return; }
    const result = await createCompleteLookJobAction({ catalogId: detail.catalog.id, sourceJobId });
    setLookBusy(false);
    if (!result.ok) setError(result.message ?? "Could not queue Complete the Look generation");
    else setSuccess(`${summary} Skipped styles retain their explanation on the product page.`);
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
          catalogId={detail.catalog.id}
          initialSearch={initialSearch}
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
        <CollapsibleCard key={job.id} title={`${job.jobType === "BULK_RENAME" ? "Bulk rename preview" : job.jobType.toLowerCase().replaceAll("_", " ")} · ${formatDate(job.createdAt)}`} headerActions={<CatalogStatusBadge status={job.status} />}>
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
            <p className="text-xs text-[#1a1a1a]/55">{job.jobType === "BULK_RENAME" ? `Scope: ${job.scopeType === "ALL_ACTIVE" ? "all active products" : "current filtered products"} · Job ${job.publicId}` : `Scope: ${job.scopeType === "LEGACY" ? job.departmentMode.toLowerCase() : job.scopeType === "ALL" ? "all catalogue" : `${job.scopeType.toLowerCase()}: ${job.scopeValue ?? ""}`} · ${job.colorVariantCount} color(s) per product · Job ${job.publicId}`}</p>
            <div className="flex gap-2">
              {canEdit && (job.status === "QUEUED" || job.status === "RUNNING") && <Button variant="danger" size="sm" loading={busyJobId === job.id} onClick={() => void stop(job)}><Icon type="warning" size="sm" /> Stop</Button>}
              {canEdit && (job.status === "FAILED" || job.status === "COMPLETED_WITH_ERRORS") && <Button variant="secondary" size="sm" loading={busyJobId === job.id} onClick={() => void retry(job.id)}><Icon type="refresh" size="sm" /> Retry failures</Button>}
            </div>
          </div>
        </CollapsibleCard>
      ))}</div>,
    },
    {
      id: "export",
      label: "Export",
      icon: <Icon type="download" size="sm" />,
      content: exportSummary ? (
        <div className="mt-6 space-y-6">
          <Card
            title="UPC CSV"
            description="One row per variant, boolean availability, and an ordered image list with the front image first."
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
          <Card
            title="Complete the Look relationships"
            description="One row per ready colour style, with related styles in persisted outfit order."
            headerActions={<DownloadCompleteLookCsvButton catalogSlug={detail.catalog.slug} />}
          >
            <p className="text-sm text-[#1a1a1a]/65">{completeLookExportSummary?.rowCount ?? 0} ready relationship row(s)</p>
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
            <NoticeBox variant="success" title="Ready for export">All persisted products pass the UPC CSV export checks.</NoticeBox>
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
  const completedInfoJobs = detail.jobs.filter((job) => job.jobType === "CATALOG_INFO" && (job.status === "COMPLETED" || job.status === "COMPLETED_WITH_ERRORS"));
  const selectedCoreTarget = coreTarget === "latest" ? defaultCoreWorkflowTarget(completedInfoJobs) : coreTarget;
  const completeLookGateReady = detail.counts.styles > 0 && detail.counts.readyCoreImages >= detail.counts.styles * 2;

  return (
    <div className="px-8 py-6 space-y-8">
      <PageHeader
        title={detail.catalog.name}
        description={`${detail.catalog.brandName} · ${detail.catalog.externalPrefix} · ${detail.catalog.segment}`}
        leadingVisual={<CatalogBrandLogo slug={detail.catalog.slug} brandName={detail.catalog.brandName} size="header" />}
        actions={<><Button variant="secondary" onClick={() => router.push("/admin/catalogs")}><Icon type="arrow-left" size="sm" /> All catalogs</Button>{canDelete && <Button variant="danger" onClick={() => void openDeleteDialog()}>Delete full catalogue</Button>}{canEdit && <Button onClick={() => setShowAdd(true)}><Icon type="plus" size="sm" /> Generate catalogue information</Button>}</>}
      />
      <Modal isOpen={showDelete} onClose={() => !deleteBusy && setShowDelete(false)} title="Delete full catalogue" size="md" footer={<div className="flex justify-end gap-3"><Button variant="ghost" onClick={() => setShowDelete(false)} disabled={deleteBusy}>Cancel</Button><Button variant="danger" disabled={!deleteSummary || (deleteConfirmation !== deleteSummary.name && deleteConfirmation !== deleteSummary.slug)} loading={deleteBusy} onClick={() => void deleteCatalog()}>Delete catalogue data</Button></div>}>
        {deleteSummary && <div className="space-y-4"><NoticeBox variant="error" title="Permanent deletion">Catalogue products and related records will be permanently deleted. The inactive catalogue record remains to prevent seed profiles from recreating it.</NoticeBox><dl className="grid grid-cols-2 gap-2 text-sm">{[["Active products", deleteSummary.activeProducts], ["Archived products", deleteSummary.archivedProducts], ["Styles", deleteSummary.styles], ["Variants", deleteSummary.variants], ["Image assets", deleteSummary.imageAssets], ["Complete the Look", deleteSummary.completeLooks], ["Jobs", deleteSummary.jobs], ["Tasks", deleteSummary.tasks]].map(([label, count]) => <div key={label} className="rounded-lg bg-white/35 p-3"><dt className="text-[#1a1a1a]/60">{label}</dt><dd className="font-semibold">{count}</dd></div>)}</dl><FormInput id="delete-catalog-confirm" label={`Type “${deleteSummary.name}” or “${deleteSummary.slug}” to confirm`} value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" /></div>}
      </Modal>
      {error && <NoticeBox variant="error">{error}</NoticeBox>}
      {lookGateIssues.length > 0 && <NoticeBox variant="warning" title="Full-catalogue core image gate"><p className="mb-2">Every active style needs READY FRONT and BACK images. Showing the first {lookGateIssues.length} affected styles:</p><ul className="list-disc space-y-1 pl-5">{lookGateIssues.map((item) => <li key={item.styleId}><Link className="font-medium underline" href={`/admin/catalogs/${detail.catalog.slug}/products/${item.productExternalId}`}>{item.styleExternalId}</Link>: missing {item.missingRoles.join(", ")}{item.failedRoles.length ? ` (failed: ${item.failedRoles.join(", ")})` : ""}</li>)}</ul><p className="mt-2">In Step 2, target all active products missing core images to repair these styles.</p></NoticeBox>}
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
      <ManualCatalogWorkflow
        canEdit={canEdit}
        jobs={completedInfoJobs}
        coreTarget={selectedCoreTarget}
        onCoreTargetChange={setCoreTarget}
        coreBusy={coreBusy}
        lookBusy={lookBusy}
        lookTarget={lookTarget}
        onLookTargetChange={setLookTarget}
        onGenerateInformation={() => setShowAdd(true)}
        onStartCoreImages={() => void startCoreImages()}
        onStartCompleteLooks={() => void startCompleteLooks()}
        counts={detail.counts}
        canStartCompleteLooks={completeLookGateReady}
      />
      {activeJobs.map((job) => <Card key={job.id} title="Generation in progress" description={`Job ${job.publicId}`} headerActions={<CatalogStatusBadge status={job.status} />}><JobProgress job={job} /></Card>)}
      <Tabs tabs={tabs} defaultTab="products" />
      <AddProductsModal key={showAdd ? detail.catalog.id : "closed"} catalog={showAdd ? detail.catalog : null} onClose={() => setShowAdd(false)} onCreated={async () => { setShowAdd(false); await refresh(); }} />
    </div>
  );
}
