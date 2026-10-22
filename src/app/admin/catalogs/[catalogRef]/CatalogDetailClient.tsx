"use client";

import { useRouter } from "next/navigation";
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
import type {
  CatalogDetailView,
  CatalogJobView,
} from "@/modules/synthetic_catalog/admin/types";
import { CATALOG_IMAGE_MODEL_OPTIONS } from "@/modules/synthetic_catalog/config/profiles";
import {
  getCatalogDetailAction,
  getCatalogExportSummaryAction,
  retryCatalogGenerationJobAction,
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
  const expectedImages = job.jobType === "REGENERATE_IMAGE" ? 1 : expectedProducts * 3;
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
        <span>Products: {job.completedProducts}/{expectedProducts}</span>
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

  return (
    <Card title="Generation settings" description="Defaults apply to newly queued jobs; existing jobs retain their stored models.">
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
  const [detail, setDetail] = useState(initialDetail);
  const [exportSummary, setExportSummary] = useState(initialExportSummary);
  const [showAdd, setShowAdd] = useState(false);
  const [busyJobId, setBusyJobId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
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
            <p className="text-xs text-[#1a1a1a]/55">Department: {job.departmentMode.toLowerCase()} · Job {job.publicId}</p>
            {canEdit && (job.status === "FAILED" || job.status === "COMPLETED_WITH_ERRORS") && <Button variant="secondary" size="sm" loading={busyJobId === job.id} onClick={() => void retry(job.id)}><Icon type="refresh" size="sm" /> Retry failures</Button>}
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

  return (
    <div className="px-8 py-6 space-y-8">
      <PageHeader
        title={detail.catalog.name}
        description={`${detail.catalog.brandName} · ${detail.catalog.externalPrefix} · ${detail.catalog.segment}`}
        actions={<><Button variant="secondary" onClick={() => router.push("/admin/catalogs")}><Icon type="arrow-left" size="sm" /> All catalogs</Button>{canEdit && <Button onClick={() => setShowAdd(true)}><Icon type="plus" size="sm" /> Add products</Button>}</>}
      />
      {error && <NoticeBox variant="error">{error}</NoticeBox>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ["Products", detail.counts.products],
          ["Styles", detail.counts.styles],
          ["Variants", detail.counts.variants],
          ["Ready images", detail.counts.readyImages],
          ["Failed images", detail.counts.failedImages],
        ].map(([label, value]) => <Card key={label} className="text-center"><p className="text-3xl font-bold text-[#1a1a1a]">{value}</p><p className="text-xs font-medium text-[#1a1a1a]/55">{label}</p></Card>)}
      </div>
      {activeJobs.map((job) => <Card key={job.id} title="Generation in progress" description={`Job ${job.publicId}`} headerActions={<CatalogStatusBadge status={job.status} />}><JobProgress job={job} /></Card>)}
      <Tabs tabs={tabs} defaultTab="products" />
      <AddProductsModal key={showAdd ? detail.catalog.id : "closed"} catalog={showAdd ? detail.catalog : null} onClose={() => setShowAdd(false)} onCreated={async () => { setShowAdd(false); await refresh(); }} />
    </div>
  );
}
