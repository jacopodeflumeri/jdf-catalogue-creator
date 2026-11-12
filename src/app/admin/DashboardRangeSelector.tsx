"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ButtonToggleGroup from "@/components/ui/ButtonToggleGroup";
import { parseDashboardRange } from "@/modules/synthetic_catalog/admin/dashboard";
import type { DashboardRange } from "@/modules/synthetic_catalog/admin/dashboard-types";

const OPTIONS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

export default function DashboardRangeSelector({ initialRange }: { initialRange: DashboardRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const range = parseDashboardRange(searchParams.get("range") ?? initialRange);

  function selectRange(value: string) {
    const nextRange = parseDashboardRange(value);
    const params = new URLSearchParams(searchParams.toString());
    if (nextRange === "30d") params.delete("range");
    else params.set("range", nextRange);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="sr-only">Dashboard timeframe</legend>
      <ButtonToggleGroup buttons={OPTIONS} value={range} onChange={selectRange} size="sm" className="flex-wrap" />
    </fieldset>
  );
}
