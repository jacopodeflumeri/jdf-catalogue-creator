"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import NoticeBox from "@/components/ui/NoticeBox";
import PageHeader from "@/components/ui/PageHeader";
import { getProductImageStatus } from "@/modules/synthetic_catalog/admin/product-image-status";
import type {
  CatalogImageView,
  CatalogProductDetailView,
} from "@/modules/synthetic_catalog/admin/types";
import {
  getCatalogProductDetailAction,
  regenerateCatalogImageAction,
} from "@/modules/synthetic_catalog/server/admin-actions";
import CatalogStatusBadge from "../../../CatalogStatusBadge";
import { sanitizeCatalogFrom } from "@/modules/synthetic_catalog/admin/product-filters";

const ACTIVE_IMAGE_STATUSES = new Set(["QUEUED", "GENERATING"]);
const IMAGE_ROLES = ["FRONT", "BACK"] as const;

function formatMoney(value: string, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(value));
}

function imageLabel(role: CatalogImageView["role"]): string {
  return role === "ON_MODEL" ? "On model" : role.toLowerCase().replace(/^./, (value) => value.toUpperCase());
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-[#1a1a1a]/45">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-[#1a1a1a]">{value}</dd>
    </div>
  );
}

function ImageTile({
  image,
  role,
  canEdit,
  busy,
  onRegenerate,
}: {
  image: CatalogImageView | undefined;
  role: CatalogImageView["role"];
  canEdit: boolean;
  busy: boolean;
  onRegenerate: () => void;
}) {
  const label = imageLabel(role);
  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-white/70 bg-white/30">
        {image?.url ? (
          <Image
            src={image.url}
            alt={`${label} view`}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[#1a1a1a]/45">
            <Icon type={image?.status === "FAILED" ? "exclamation" : "camera"} size="lg" />
            <span className="text-xs capitalize">{image?.status.toLowerCase() ?? "missing"}</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#1a1a1a]">{label}</p>
          <p className="mt-0.5 text-xs text-[#1a1a1a]/50">{image?.publicId ?? "No asset"}</p>
        </div>
        {image && canEdit && !ACTIVE_IMAGE_STATUSES.has(image.status) && (
          <Button variant="ghost" size="xs" loading={busy} onClick={onRegenerate}>
            <Icon type="refresh" size="xs" /> Regenerate
          </Button>
        )}
      </div>
      {image?.errorMessage && (
        <p className="rounded-lg bg-[rgba(224,85,102,0.1)] px-3 py-2 text-xs text-[#932231]">
          {image.errorMessage}
        </p>
      )}
    </div>
  );
}

export default function ProductDetailClient({
  initialDetail,
  canEdit,
  from,
}: {
  initialDetail: CatalogProductDetailView;
  canEdit: boolean;
  from: string | null;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState(initialDetail);
  const [busyImageId, setBusyImageId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { catalog, product } = detail;
  const hasActiveImage = product.styles.some((style) => style.images.some((image) => ACTIVE_IMAGE_STATUSES.has(image.status)));

  const refresh = useCallback(async () => {
    const next = await getCatalogProductDetailAction(catalog.slug, product.externalId);
    if (next) setDetail(next);
  }, [catalog.slug, product.externalId]);

  useEffect(() => {
    if (!hasActiveImage) return;
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [hasActiveImage, refresh]);

  async function regenerate(imageId: number) {
    setBusyImageId(imageId);
    setError(null);
    const result = await regenerateCatalogImageAction(imageId);
    if (!result.ok) setError(result.message ?? "Could not queue image regeneration");
    await refresh();
    setBusyImageId(null);
  }

  const variants = product.styles.flatMap((style) => style.variants);
  const totalStock = variants.reduce((total, variant) => total + variant.stock, 0);
  const displayPrice = product.salePrice ?? product.basePrice;
  const imageStatus = getProductImageStatus(product);

  return (
    <div className="space-y-8 px-8 py-6">
      <PageHeader
        title={product.name}
        description={`${catalog.name} / ${product.externalId}`}
        actions={
          <Button variant="secondary" onClick={() => router.push(sanitizeCatalogFrom(from, catalog.slug))}>
            <Icon type="arrow-left" size="sm" /> Back to catalog
          </Button>
        }
      />

      {error && <NoticeBox variant="error">{error}</NoticeBox>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="text-center">
          <CatalogStatusBadge status={product.status} />
          <p className="mt-2 text-xs font-medium text-[#1a1a1a]/55">Product status</p>
        </Card>
        <Card className="text-center">
          <CatalogStatusBadge status={imageStatus} />
          <p className="mt-2 text-xs font-medium text-[#1a1a1a]/55">Image status</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-[#1a1a1a]">{variants.length}</p>
          <p className="text-xs font-medium text-[#1a1a1a]/55">Size variants</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-[#1a1a1a]">{totalStock}</p>
          <p className="text-xs font-medium text-[#1a1a1a]/55">Units in stock</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card title="Product attributes" description={product.description}>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-6">
            <DetailItem label="Department" value={product.department} />
            <DetailItem label="Category" value={product.category} />
            <DetailItem label="Subcategory" value={product.subcategory} />
            <DetailItem label="Material" value={product.material} />
            <DetailItem label="Season" value={product.season} />
            <DetailItem label="Pattern" value={product.patternCode ?? "None"} />
            <DetailItem label="Embellishments" value={product.embellishmentCodes.length ? product.embellishmentCodes.join(", ") : "None"} />
            <DetailItem label="Brand" value={catalog.brandName} />
            <DetailItem label="Base price" value={formatMoney(product.basePrice, product.currency)} />
            <DetailItem label="Current price" value={formatMoney(displayPrice, product.currency)} />
          </dl>
        </Card>
      </div>

      {product.styles.map((style) => <div key={style.id} className="space-y-6">
      <Card title={`${style.colorName} · ${style.externalId}`} description={style.status.toLowerCase()} headerActions={<span className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: style.colorHex }} aria-label={`${style.colorName} swatch`} />}>
        <div className="grid gap-5 sm:grid-cols-2">
          {IMAGE_ROLES.map((role) => {
            const image = style.images.find((candidate) => candidate.role === role);
            return <ImageTile key={`${style.id}-${role}`} role={role} image={image} canEdit={canEdit} busy={busyImageId === image?.id} onRegenerate={() => image && void regenerate(image.id)} />;
          })}
        </div>
      </Card>
      <Card title="Variants and inventory" description={`Size-level identifiers, availability, and stock for ${style.colorName}.`} noPaddingContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="ds-table-head">
              <tr>
                {[
                  "Size",
                  "SKU",
                  "External ID",
                  "Availability",
                  "Stock",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-8 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1a1a1a]/55"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {style.variants.map((variant) => (
                <tr key={variant.id} className="ds-table-row">
                  <td className="px-8 py-4 text-sm font-semibold">{variant.size}</td>
                  <td className="px-8 py-4 text-sm">{variant.sku}</td>
                  <td className="px-8 py-4 text-sm">{variant.externalId}</td>
                  <td className="px-8 py-4 text-sm capitalize">
                    {variant.availability.toLowerCase().replaceAll("_", " ")}
                  </td>
                  <td className="px-8 py-4 text-sm">{variant.stock}</td>
                </tr>
              ))}
              {style.variants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-10 text-center text-sm text-[#1a1a1a]/55">
                    No variants are available for this product.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Complete the Look" description={`Optional outfit recommendation for the ${style.colorName} colour style.`}>
        {style.completeLook?.imagePublicId && style.completeLook.status === "READY" ? <div className="grid gap-5 md:grid-cols-[minmax(180px,280px)_1fr]">
          <Image src={`/api/catalog-assets/${style.completeLook.imagePublicId}`} alt={`Complete the Look for ${style.colorName}`} width={512} height={768} className="h-auto w-full rounded-xl object-cover" />
          <div><p className="text-sm font-semibold">Companion products in outfit order</p><ol className="mt-3 space-y-2">{style.completeLook.companions.map((companion, index) => <li key={`${companion.externalId}:${companion.styleExternalId}`} className="text-sm"><span className="mr-2 text-[#1a1a1a]/50">{index + 1}.</span><Link className="font-medium text-primary underline" href={`/admin/catalogs/${catalog.slug}/products/${companion.externalId}`}>{companion.name}</Link><span className="ml-2 text-[#1a1a1a]/60">{companion.outfitSlot.replaceAll("_", " ")} · {companion.colorName} ({companion.styleExternalId})</span></li>)}</ol></div>
        </div> : <div className="flex flex-wrap items-center justify-between gap-3"><div><CatalogStatusBadge status={style.completeLook?.status ?? "MISSING"} />{style.completeLook?.reason && <p className="mt-2 max-w-2xl text-sm text-[#1a1a1a]/65">{style.completeLook.reason}</p>}{style.completeLook?.companions.length ? <p className="mt-2 text-sm text-[#1a1a1a]/60">{style.completeLook.companions.map((item) => `${item.name} · ${item.colorName}`).join("; ")}</p> : null}</div>{canEdit && style.completeLook?.status === "FAILED" && style.completeLook.imageAssetId != null && <Button size="sm" variant="secondary" loading={busyImageId === style.completeLook.imageAssetId} onClick={() => void regenerate(style.completeLook!.imageAssetId!)}><Icon type="refresh" size="sm" /> Regenerate image</Button>}</div>}
      </Card>
      </div>)}
    </div>
  );
}
