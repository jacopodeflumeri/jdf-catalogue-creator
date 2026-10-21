"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
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
  CatalogImageView,
  CatalogJobView,
} from "@/modules/synthetic_catalog/admin/types";
import { CATALOG_IMAGE_MODEL_OPTIONS } from "@/modules/synthetic_catalog/config/profiles";
import {
  getCatalogDetailAction,
  regenerateCatalogImageAction,
  retryCatalogGenerationJobAction,
  updateCatalogSettingsAction,
} from "@/modules/synthetic_catalog/server/admin-actions";
import AddProductsModal from "../AddProductsModal";
import CatalogStatusBadge from "../CatalogStatusBadge";

const ACTIVE_STATUSES = new Set(["QUEUED", "RUNNING"]);
const ACTIVE_IMAGE_STATUSES = new Set(["QUEUED", "GENERATING"]);

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatMoney(value: string, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(value));
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

function ImageTile({
  image,
  canEdit,
  busy,
  onRegenerate,
}: {
  image: CatalogImageView;
  canEdit: boolean;
  busy: boolean;
  onRegenerate: () => void;
}) {
  const label = image.role === "ON_MODEL" ? "On model" : image.role.toLowerCase();
  return (
    <div className="space-y-2">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-white/70 bg-white/30">
        {image.url ? (
          <Image src={image.url} alt={`${label} product view`} fill sizes="(max-width: 768px) 30vw, 180px" className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[#1a1a1a]/45">
            <Icon type={image.status === "FAILED" ? "exclamation" : "camera"} size="lg" />
            <span className="text-xs">{image.status.toLowerCase()}</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium capitalize text-[#1a1a1a]/65">{label}</span>
        {canEdit && !ACTIVE_IMAGE_STATUSES.has(image.status) && (
          <Button variant="ghost" size="xs" loading={busy} onClick={onRegenerate} title={`Regenerate ${label} image`}>
            <Icon type="refresh" size="xs" />
          </Button>
        )}
      </div>
      {image.errorMessage && <p className="line-clamp-2 text-xs text-[#932231]" title={image.errorMessage}>{image.errorMessage}</p>}
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

export default function CatalogDetailClient({ initialDetail, canEdit }: { initialDetail: CatalogDetailView; canEdit: boolean }) {
  const router = useRouter();
  const [detail, setDetail] = useState(initialDetail);
  const [showAdd, setShowAdd] = useState(false);
  const [busyImageId, setBusyImageId] = useState<number | null>(null);
  const [busyJobId, setBusyJobId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasActiveJob = detail.jobs.some((job) => ACTIVE_STATUSES.has(job.status));

  const refresh = useCallback(async () => {
    const next = await getCatalogDetailAction(detail.catalog.slug);
    if (next) setDetail(next);
  }, [detail.catalog.slug]);

  useEffect(() => {
    if (!hasActiveJob) return;
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [hasActiveJob, refresh]);

  async function regenerate(imageId: number) {
    setBusyImageId(imageId);
    setError(null);
    const result = await regenerateCatalogImageAction(imageId);
    setBusyImageId(null);
    if (!result.ok) setError(result.message ?? "Could not queue image regeneration");
    await refresh();
  }

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
      content: detail.products.length === 0 ? (
        <EmptyState className="mt-6" icon="fashion" title="No products yet" description="Queue the first generation job to build this catalog." action={canEdit ? <Button onClick={() => setShowAdd(true)}><Icon type="plus" size="sm" /> Add products</Button> : undefined} />
      ) : (
        <div className="mt-6 grid gap-6 2xl:grid-cols-2">
          {detail.products.map((product) => (
            <Card key={product.id} title={product.name} description={`${product.externalId} · ${product.category}`} headerActions={<CatalogStatusBadge status={product.status} />}>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(330px,1.2fr)]">
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed text-[#1a1a1a]/68">{product.description}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{product.department.toLowerCase()}</Badge>
                    <Badge variant="outline">{product.subcategory}</Badge>
                    <Badge variant="outline">{product.material}</Badge>
                    <Badge variant="outline">{product.season}</Badge>
                  </div>
                  <p className="text-xl font-bold text-[#1a1a1a]">
                    {product.salePrice ? <><span className="mr-2">{formatMoney(product.salePrice, product.currency)}</span><span className="text-sm font-normal text-[#1a1a1a]/45 line-through">{formatMoney(product.basePrice, product.currency)}</span></> : formatMoney(product.basePrice, product.currency)}
                  </p>
                  {product.style && (
                    <div>
                      <p className="text-sm font-semibold text-[#1a1a1a]">{product.style.colorName} · {product.style.externalId}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {product.style.variants.map((variant) => <Badge key={variant.id} variant={variant.stock > 0 ? "success" : "gray"} size="xs">{variant.size}: {variant.stock}</Badge>)}
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {product.style?.images.map((image) => (
                    <ImageTile key={image.id} image={image} canEdit={canEdit} busy={busyImageId === image.id} onRegenerate={() => void regenerate(image.id)} />
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ),
    },
    {
      id: "jobs",
      label: `Jobs (${detail.jobs.length})`,
      icon: <Icon type="clock" size="sm" />,
      content: <div className="mt-6 space-y-4">{detail.jobs.map((job) => (
        <Card key={job.id} title={`${job.jobType.toLowerCase().replaceAll("_", " ")} · ${formatDate(job.createdAt)}`} headerActions={<CatalogStatusBadge status={job.status} />}>
          <JobProgress job={job} />
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-xs text-[#1a1a1a]/55">Department: {job.departmentMode.toLowerCase()} · Job {job.publicId}</p>
            {canEdit && (job.status === "FAILED" || job.status === "COMPLETED_WITH_ERRORS") && <Button variant="secondary" size="sm" loading={busyJobId === job.id} onClick={() => void retry(job.id)}><Icon type="refresh" size="sm" /> Retry failures</Button>}
          </div>
        </Card>
      ))}</div>,
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
