export type CoreWorkflowTarget = `batch:${number}` | "all-missing";
export type CoreImageActionInput = { catalogId: number; sourceJobId: number; allMissing: false } | { catalogId: number; allMissing: true };

export function defaultCoreWorkflowTarget(jobs: Array<{ id: number; createdAt: string }>): CoreWorkflowTarget {
  const latest = [...jobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  return latest ? `batch:${latest.id}` : "all-missing";
}

export function coreImageActionInput(catalogId: number, target: CoreWorkflowTarget): CoreImageActionInput | null {
  if (target === "all-missing") return { catalogId, allMissing: true };
  const sourceJobId = Number(target.slice("batch:".length));
  if (!Number.isSafeInteger(sourceJobId) || sourceJobId <= 0) return null;
  return { catalogId, sourceJobId, allMissing: false };
}
