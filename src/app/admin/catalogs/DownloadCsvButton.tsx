"use client";

import { useState, type ComponentProps } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { useToast } from "@/components/providers/ToastProvider";

function DownloadCatalogFileButton({
  catalogSlug,
  kind,
  disabled = false,
  size = "sm",
}: {
  catalogSlug: string;
  kind: "csv" | "validation-report" | "complete-look-csv";
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  async function download() {
    setLoading(true);
    try {
      const response = await fetch(
        kind === "csv"
          ? `/api/admin/catalogs/${encodeURIComponent(catalogSlug)}/export.csv`
          : kind === "complete-look-csv"
            ? `/api/admin/catalogs/${encodeURIComponent(catalogSlug)}/complete-look.csv`
            : `/api/admin/catalogs/${encodeURIComponent(catalogSlug)}/validation-report.json`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        addToast({
          type: "error",
          message: payload?.error ?? "The catalog file could not be generated",
        });
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download =
        kind === "csv" ? `${catalogSlug}.csv` : kind === "complete-look-csv" ? `${catalogSlug}-complete-the-look.csv` : `${catalogSlug}-validation-report.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      addToast({
        type: "error",
        message: "The catalog file could not be downloaded",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" size={size} onClick={() => void download()} disabled={disabled} loading={loading}>
      <Icon type="download" size="sm" />
      {kind === "csv" ? "Download UPC CSV" : kind === "complete-look-csv" ? "Download relationships CSV" : "Validation report"}
    </Button>
  );
}

export default function DownloadCsvButton(
  props: Omit<ComponentProps<typeof DownloadCatalogFileButton>, "kind">,
) {
  return <DownloadCatalogFileButton {...props} kind="csv" />;
}

export function DownloadValidationReportButton(
  props: Omit<ComponentProps<typeof DownloadCatalogFileButton>, "kind">,
) {
  return <DownloadCatalogFileButton {...props} kind="validation-report" />;
}

export function DownloadCompleteLookCsvButton(
  props: Omit<ComponentProps<typeof DownloadCatalogFileButton>, "kind">,
) {
  return <DownloadCatalogFileButton {...props} kind="complete-look-csv" />;
}
