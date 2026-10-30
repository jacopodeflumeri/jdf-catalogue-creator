"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import type { CatalogOverviewView } from "@/modules/synthetic_catalog/admin/types";
import { getCatalogBrandHeroPath } from "@/modules/synthetic_catalog/config/brand-assets";
import CatalogStatusBadge from "./CatalogStatusBadge";
import CatalogBrandLogo from "./CatalogBrandLogo";
import NewCatalogModal from "./NewCatalogModal";

export default function CatalogOverviewClient({
  initialCatalogs,
  canEdit,
}: {
  initialCatalogs: CatalogOverviewView[];
  canEdit: boolean;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="px-8 py-6 space-y-8">
      <PageHeader
        title="Synthetic Catalogs"
        description="Generate persistent fashion products, variants, and imagery through Mapp-attributed LiteLLM jobs."
        actions={canEdit ? <Button onClick={() => setCreating(true)}><Icon type="plus" size="sm" /> New catalogue</Button> : undefined}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {initialCatalogs.map((catalog, index) => {
          const heroPath = getCatalogBrandHeroPath(catalog.slug);

          return (
          <Link
            key={catalog.id}
            href={`/admin/catalogs/${catalog.slug}`}
            className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            aria-label={`Open ${catalog.name} catalogue`}
          >
          <Card
            title={heroPath ? (
              <span className="flex min-w-0 items-center gap-4">
                <CatalogBrandLogo slug={catalog.slug} brandName={catalog.brandName} size="title" />
                <span className="flex min-w-0 flex-col items-start gap-1">
                  <span className="truncate">{catalog.name}</span>
                  <span className="text-sm font-normal leading-relaxed text-[#1a1a1a]/60">{catalog.brandName} · {catalog.segment}</span>
                </span>
              </span>
            ) : catalog.name}
            description={heroPath ? undefined : `${catalog.brandName} · ${catalog.segment}`}
            hoverable
            headerPaddingClassName={heroPath ? "px-8 pt-6 pb-1" : undefined}
            contentPaddingClassName={heroPath ? "px-8 pt-1 pb-6" : undefined}
            showHeaderDivider={!heroPath}
            headerActions={catalog.latestJob ? <CatalogStatusBadge status={catalog.latestJob.status} /> : null}
          >
            {heroPath ? (
              <div className="mb-5 overflow-hidden rounded-xl border border-white/70 bg-white/30 shadow-[0_4px_18px_rgba(26,26,26,0.06)]">
                <Image
                  src={heroPath}
                  alt={`${catalog.brandName} catalogue campaign`}
                  width={1918}
                  height={821}
                  sizes="(min-width: 1280px) 50vw, 100vw"
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  className="h-auto w-full object-contain"
                />
              </div>
            ) : (
              <div className="mb-5 flex min-w-0 items-center gap-4">
                <CatalogBrandLogo slug={catalog.slug} brandName={catalog.brandName} />
                <div className="min-w-0"><p className="font-medium text-[#1a1a1a]">{catalog.brandName}</p><p className="text-sm text-[#1a1a1a]/60">{catalog.segment}</p></div>
              </div>
            )}
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
          </Card>
          </Link>
          );
        })}
      </div>
      {canEdit && <NewCatalogModal open={creating} onClose={() => setCreating(false)} catalogs={initialCatalogs} />}
    </div>
  );
}
