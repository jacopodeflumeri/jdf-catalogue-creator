"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { useToast } from "@/components/providers/ToastProvider";

export default function DownloadCsvButton({
  catalogSlug,
  disabled = false,
  size = "sm",
}: {
  catalogSlug: string;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  async function download() {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/catalogs/${encodeURIComponent(catalogSlug)}/export.csv`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        addToast({
          type: "error",
          message: payload?.error ?? "The catalog CSV could not be generated",
        });
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${catalogSlug}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      addToast({
        type: "error",
        message: "The catalog CSV could not be downloaded",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" size={size} onClick={() => void download()} disabled={disabled} loading={loading}>
      <Icon type="download" size="sm" /> Download CSV
    </Button>
  );
}
