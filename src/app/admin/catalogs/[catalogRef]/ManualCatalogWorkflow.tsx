"use client";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormSelect from "@/components/ui/form/FormSelect";
import Icon from "@/components/ui/Icon";

type WorkflowJob = { id: number; createdAt: string; informationReadyProducts: number; informationReadyStyles: number };
type CoreTarget = `batch:${number}` | "all-missing";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function ManualCatalogWorkflow({
  canEdit,
  jobs,
  coreTarget,
  onCoreTargetChange,
  coreBusy,
  lookBusy,
  lookTarget,
  onLookTargetChange,
  onGenerateInformation,
  onStartCoreImages,
  onStartCompleteLooks,
  counts,
  canStartCompleteLooks,
}: {
  canEdit: boolean;
  jobs: WorkflowJob[];
  coreTarget: CoreTarget;
  onCoreTargetChange: (value: CoreTarget) => void;
  coreBusy: boolean;
  lookBusy: boolean;
  lookTarget: string;
  onLookTargetChange: (value: string) => void;
  onGenerateInformation: () => void;
  onStartCoreImages: () => void;
  onStartCompleteLooks: () => void;
  counts: { styles: number; readyCoreImages: number; pendingCoreImages: number; failedCoreImages: number };
  canStartCompleteLooks: boolean;
}) {
  const completedBatches = [...jobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const coreOptions = [
    ...completedBatches.map((job) => ({
      value: `batch:${job.id}`,
      label: `Batch ${formatDate(job.createdAt)} — ${job.informationReadyProducts} products / ${job.informationReadyStyles} styles`,
    })),
    { value: "all-missing", label: "All active products missing core images" },
  ];
  const lookStatus = counts.styles === 0 ? "No eligible products" : canStartCompleteLooks ? "Ready" : "Waiting for core images";

  return (
    <Card title="Manual catalogue workflow" description="Run each stage when you are ready. Catalogue information creates no images.">
      <div className="grid gap-4 md:grid-cols-3 md:auto-rows-fr" data-workflow-grid>
        <section className="flex h-full flex-col rounded-xl border border-white/70 bg-white/30 p-4" aria-labelledby="workflow-step-1-title" data-workflow-card="step-1">
          <header>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="purple" size="xs">Step 1</Badge>
              <Badge variant={jobs.length ? "success" : "gray"} size="xs">{jobs.length ? `${jobs.length} completed ${jobs.length === 1 ? "batch" : "batches"}` : "Configure next"}</Badge>
            </div>
            <h4 id="workflow-step-1-title" className="mt-3 text-base font-semibold text-[#1a1a1a]">Catalogue information</h4>
            <p className="mt-2 text-sm leading-relaxed text-[#1a1a1a]/65">Generate products, colour styles, and size/inventory rows.</p>
          </header>
          <div className="mt-4 flex flex-1 items-center rounded-xl border border-white/70 bg-white/35 px-4 py-3 text-sm leading-relaxed text-[#1a1a1a]/65" data-workflow-control="step-1">
            Scope, quantity, and colour variants are selected in the next dialog.
          </div>
          <footer className="mt-4 border-t border-white/65 pt-4" data-workflow-actions="step-1">
            {canEdit ? <Button size="sm" className="min-h-11 w-full" onClick={onGenerateInformation}><Icon type="plus" size="sm" />Create catalogue information</Button> : <p className="text-xs leading-relaxed text-[#1a1a1a]/60">Editors can create catalogue information.</p>}
          </footer>
        </section>

        <section className="flex h-full flex-col rounded-xl border border-white/70 bg-white/30 p-4" aria-labelledby="workflow-step-2-title" data-workflow-card="step-2">
          <header>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="purple" size="xs">Step 2</Badge>
              <div className="flex flex-wrap gap-1.5" aria-label="Core image status">
                <Badge variant="success" size="xxs">Ready {counts.readyCoreImages}</Badge>
                <Badge variant="gray" size="xxs">Pending {counts.pendingCoreImages}</Badge>
                {counts.failedCoreImages > 0 && <Badge variant="danger" size="xxs">Failed {counts.failedCoreImages}</Badge>}
                {counts.failedCoreImages === 0 && <span className="px-1 text-xs text-[#1a1a1a]/60">Failed 0</span>}
              </div>
            </div>
            <h4 id="workflow-step-2-title" className="mt-3 text-base font-semibold text-[#1a1a1a]">Core images</h4>
            <p className="mt-2 text-sm leading-relaxed text-[#1a1a1a]/65">Generate FRONT and BACK product images for each colour style.</p>
          </header>
          <div className="mt-4 flex-1" data-workflow-control="step-2">
            {canEdit ? <FormSelect id="core-image-target" label="Target" value={coreTarget} onChange={(event) => onCoreTargetChange(event.target.value as CoreTarget)} options={coreOptions} helpText="Batch targets only that information batch. All active products targets every active style still missing a required image." /> : <p className="rounded-xl border border-white/70 bg-white/35 px-4 py-3 text-xs leading-relaxed text-[#1a1a1a]/60">Core image generation is available to editors.</p>}
          </div>
          <footer className="mt-4 border-t border-white/65 pt-4" data-workflow-actions="step-2">
            {canEdit ? <Button size="sm" className="min-h-11 w-full" loading={coreBusy} disabled={coreBusy} onClick={onStartCoreImages}>Generate core images</Button> : <p className="text-xs leading-relaxed text-[#1a1a1a]/60">You have read-only access to this workflow.</p>}
          </footer>
        </section>

        <section className="flex h-full flex-col rounded-xl border border-white/70 bg-white/30 p-4" aria-labelledby="workflow-step-3-title" data-workflow-card="step-3">
          <header>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="purple" size="xs">Step 3</Badge>
              <Badge variant={lookStatus === "Ready" ? "success" : "gray"} size="xs">{lookStatus}</Badge>
            </div>
            <h4 id="workflow-step-3-title" className="mt-3 text-base font-semibold text-[#1a1a1a]">Complete the Look</h4>
            <p className="mt-2 text-sm leading-relaxed text-[#1a1a1a]/65">Generate one model-worn outfit image and persisted companion recommendations for each eligible colour style.</p>
          </header>
          <div className="mt-4 flex-1" data-workflow-control="step-3">
            {canEdit ? <>
              <FormSelect id="complete-look-target" label="Target" value={lookTarget} onChange={(event) => onLookTargetChange(event.target.value)} options={[{ value: "ALL", label: "All eligible active catalogue products" }, ...completedBatches.map((job) => ({ value: String(job.id), label: `Information batch ${formatDate(job.createdAt)}` }))]} />
              {!canStartCompleteLooks && <p className="mt-2 text-xs leading-relaxed text-[#1a1a1a]/65" data-look-gate-message>{counts.styles === 0 ? "There are no eligible active products to generate looks for." : "Complete all required FRONT and BACK images before generating looks."}</p>}
            </> : <p className="rounded-xl border border-white/70 bg-white/35 px-4 py-3 text-xs leading-relaxed text-[#1a1a1a]/60">Editors can start this step after the full catalogue has ready FRONT and BACK images.</p>}
          </div>
          <footer className="mt-4 border-t border-white/65 pt-4" data-workflow-actions="step-3">
            {canEdit ? <Button size="sm" className="min-h-11 w-full" loading={lookBusy} disabled={!canStartCompleteLooks || lookBusy} onClick={onStartCompleteLooks}>Generate Complete the Look</Button> : <p className="text-xs leading-relaxed text-[#1a1a1a]/60">You have read-only access to this workflow.</p>}
          </footer>
        </section>
      </div>
    </Card>
  );
}
