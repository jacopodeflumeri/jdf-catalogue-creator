"use client";

import Image from "next/image";
import { useState } from "react";
import { getCatalogBrandLogoPath } from "@/modules/synthetic_catalog/config/brand-assets";

export default function CatalogBrandLogo({ slug, brandName, size = "card" }: { slug: string; brandName: string; size?: "card" | "header" }) {
  const path = getCatalogBrandLogoPath(slug);
  const [failed, setFailed] = useState(false);
  if (!path || failed) return <span className="text-sm font-semibold text-[#1a1a1a]">{brandName}</span>;
  const dimension = size === "card" ? 88 : 112;
  return <div className={`flex shrink-0 items-center justify-center rounded-xl border border-white/80 bg-white/75 p-2 ${size === "card" ? "h-24 w-24" : "h-28 w-28"}`}>
    <Image src={path} alt={`${brandName} logo`} width={dimension} height={dimension} className="h-full w-full object-contain" onError={() => setFailed(true)} />
  </div>;
}
