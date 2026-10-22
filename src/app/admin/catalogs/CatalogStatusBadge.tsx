import Badge from "@/components/ui/Badge";

const LABELS: Record<string, string> = {
  QUEUED: "Queued",
  RUNNING: "Running",
  GENERATING: "Generating",
  COMPLETED: "Complete",
  READY: "Ready",
  COMPLETED_WITH_ERRORS: "Needs attention",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  DRAFT: "Draft",
  MISSING: "Missing",
};

export default function CatalogStatusBadge({ status }: { status: string }) {
  const variant =
    status === "COMPLETED" || status === "READY"
      ? "success"
      : status === "FAILED" || status === "COMPLETED_WITH_ERRORS"
        ? "danger"
        : status === "QUEUED" || status === "RUNNING" || status === "GENERATING"
          ? "warning"
          : "gray";
  return <Badge variant={variant}>{LABELS[status] ?? status}</Badge>;
}
