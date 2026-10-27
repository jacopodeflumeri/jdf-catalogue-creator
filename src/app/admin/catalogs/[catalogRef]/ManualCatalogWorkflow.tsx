"use client";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormSelect from "@/components/ui/form/FormSelect";
import Icon from "@/components/ui/Icon";

type WorkflowJob = { id: number; createdAt: string; informationReadyProducts: number; informationReadyStyles: number };
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export default function ManualCatalogWorkflow({ canEdit, jobs, coreSourceJobId, onCoreSourceJobChange, canStartCoreImages, coreBusy, lookBusy, lookTarget, onLookTargetChange, onGenerateInformation, onStartCoreImages, onStartAllMissingImages, onStartCompleteLooks, counts }: {
  canEdit: boolean; jobs: WorkflowJob[]; coreSourceJobId: string; onCoreSourceJobChange: (value: string) => void; canStartCoreImages: boolean; coreBusy: boolean; lookBusy: boolean; lookTarget: string; onLookTargetChange: (value: string) => void;
  onGenerateInformation: () => void; onStartCoreImages: () => void; onStartAllMissingImages: () => void; onStartCompleteLooks: () => void;
  counts: { readyCoreImages: number; pendingCoreImages: number; failedCoreImages: number };
}) {
  return <Card title="Manual catalogue workflow" description="Run each stage when you are ready. Catalogue information creates no images.">
    <div className="grid gap-4 md:grid-cols-3 md:auto-rows-fr">
      <div className="flex flex-col rounded-xl border border-white/70 bg-white/30 p-4"><div><p className="text-xs font-semibold uppercase text-[#1a1a1a]/55">Step 1</p><p className="mt-1 font-semibold">Catalogue information</p><p className="mt-2 text-sm text-[#1a1a1a]/65">Generate products, colour styles, and size/inventory rows.</p></div><div className="mt-4 md:min-h-[132px] md:flex-1" aria-hidden="true" />{canEdit && <div className="mt-auto" data-workflow-actions="step-1"><Button size="sm" onClick={onGenerateInformation}><Icon type="plus" size="sm" /> Generate information</Button></div>}</div>
      <div className="flex flex-col rounded-xl border border-white/70 bg-white/30 p-4"><div><p className="text-xs font-semibold uppercase text-[#1a1a1a]/55">Step 2</p><p className="mt-1 font-semibold">Core images</p><p className="mt-2 text-sm text-[#1a1a1a]/65">Two product images per colour style: FRONT and BACK.</p><p className="mt-2 text-xs text-[#1a1a1a]/60">Ready {counts.readyCoreImages} · Pending {counts.pendingCoreImages} · Failed {counts.failedCoreImages}</p></div>{canEdit && <div className="mt-4 md:min-h-[132px] md:flex-1">{jobs.length > 0 && <FormSelect label="Step 1 batch" value={coreSourceJobId} onChange={(event) => onCoreSourceJobChange(event.target.value)} options={jobs.map((job) => ({ value: String(job.id), label: `Batch ${formatDate(job.createdAt)} · ${job.informationReadyProducts} products / ${job.informationReadyStyles} styles` }))} />}</div>}{canEdit && <div className="mt-auto space-y-2" data-workflow-actions="step-2"><Button size="sm" loading={coreBusy} disabled={!canStartCoreImages} onClick={onStartCoreImages}>{canStartCoreImages ? "Generate batch core images" : "Waiting for Step 1"}</Button><div><Button variant="secondary" size="sm" loading={coreBusy} onClick={onStartAllMissingImages}>All products missing core images</Button></div></div>}</div>
      <div className="flex flex-col rounded-xl border border-white/70 bg-white/30 p-4"><div><p className="text-xs font-semibold uppercase text-[#1a1a1a]/55">Step 3</p><p className="mt-1 font-semibold">Complete the Look</p><p className="mt-2 text-sm text-[#1a1a1a]/65">One model-worn outfit image and persisted companion recommendation per colour style.</p></div>{canEdit ? <div className="mt-4 md:min-h-[132px] md:flex-1"><FormSelect label="Target" value={lookTarget} onChange={(event) => onLookTargetChange(event.target.value)} options={[{ value: "ALL", label: "All eligible active catalogue products" }, ...jobs.map((job) => ({ value: String(job.id), label: `Information batch ${formatDate(job.createdAt)}` }))]} /></div> : <p className="mt-4 text-xs text-[#1a1a1a]/55">Editors can start this step after the full catalogue has ready FRONT and BACK images.</p>}{canEdit && <div className="mt-auto" data-workflow-actions="step-3"><Button size="sm" loading={lookBusy} onClick={onStartCompleteLooks}>Generate Complete the Look</Button></div>}</div>
    </div>
  </Card>;
}
