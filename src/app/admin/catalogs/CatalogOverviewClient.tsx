"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import type { CatalogOverviewView } from "@/modules/synthetic_catalog/admin/types";
import AddProductsModal from "./AddProductsModal";
import CatalogStatusBadge from "./CatalogStatusBadge";
import DownloadCsvButton from "./DownloadCsvButton";
import CatalogBrandLogo from "./CatalogBrandLogo";
import NewCatalogModal from "./NewCatalogModal";

export default function CatalogOverviewClient({
  initialCatalogs,
  canEdit,
}: {
  initialCatalogs: CatalogOverviewView[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<CatalogOverviewView | null>(null);
  const [creating, setCreating] = useState(false);

  function lastGeneration(catalog: CatalogOverviewView): string {
    const value = catalog.latestJob?.finishedAt ?? catalog.latestJob?.createdAt;
    if (!value) return "No generation jobs yet";
    return `Last generation: ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))}`;
  }

  return (
    <div className="px-8 py-6 space-y-8">
      <PageHeader
        title="Synthetic Catalogs"
        description="Generate persistent fashion products, variants, and imagery through Mapp-attributed LiteLLM jobs."
        actions={canEdit ? <Button onClick={() => setCreating(true)}><Icon type="plus" size="sm" /> New catalogue</Button> : undefined}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {initialCatalogs.map((catalog) => (
          <Card
            key={catalog.id}
            title={catalog.name}
            description={`${catalog.brandName} · ${catalog.segment}`}
            hoverable
            headerActions={catalog.latestJob ? <CatalogStatusBadge status={catalog.latestJob.status} /> : null}
            footer={
              <div className="flex justify-end gap-2">
                <DownloadCsvButton catalogSlug={catalog.slug} disabled={catalog.productCount === 0} />
                {canEdit && (
                  <Button variant="secondary" size="sm" onClick={() => setSelected(catalog)}>
                    <Icon type="plus" size="sm" /> Add products
                  </Button>
                )}
                <Button size="sm" onClick={() => router.push(`/admin/catalogs/${catalog.slug}`)}>
                  Open catalog <Icon type="arrow-right" size="sm" />
                </Button>
              </div>
            }
          >
            <div className="mb-5 flex min-w-0 items-center gap-4">
              <CatalogBrandLogo slug={catalog.slug} brandName={catalog.brandName} />
              <div className="min-w-0"><p className="font-medium text-[#1a1a1a]">{catalog.brandName}</p><p className="text-sm text-[#1a1a1a]/60">{catalog.segment}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ["Products", catalog.productCount],
                ["Styles", catalog.styleCount],
                ["Variants", catalog.variantCount],
                ["Ready images", catalog.readyImageCount],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/70 bg-white/30 p-4">
                  <p className="text-2xl font-bold text-[#1a1a1a]">{value}</p>
                  <p className="text-xs font-medium text-[#1a1a1a]/55">{label}</p>
                </div>
              ))}
            </div>
            {catalog.failedImageCount > 0 && (
              <p className="mt-4 text-sm text-[#932231]">{catalog.failedImageCount} image(s) need attention</p>
            )}
            <p className="mt-4 text-xs text-[#1a1a1a]/50">{lastGeneration(catalog)}</p>
          </Card>
        ))}
      </div>
      <AddProductsModal
        key={selected?.id ?? "closed"}
        catalog={selected}
        onClose={() => setSelected(null)}
        onCreated={() => {
          const slug = selected?.slug;
          setSelected(null);
          if (slug) router.push(`/admin/catalogs/${slug}`);
        }}
      />
      {canEdit && <NewCatalogModal open={creating} onClose={() => setCreating(false)} catalogs={initialCatalogs} />}
    </div>
  );
}
