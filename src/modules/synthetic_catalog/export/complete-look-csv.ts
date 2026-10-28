import { createCsvRow } from "@/lib/utils/csv";

export const COMPLETE_LOOK_CSV_COLUMNS = [
  "main_style_id",
  "related_style_id_1",
  "related_style_id_2",
  "related_style_id_3",
] as const;

export interface CompleteLookRelationshipSource {
  productId: string;
  styleId: string;
  productStatus: string;
  archived: boolean;
  styleStatus: string;
  completeLook: {
    status: string;
    imageAsset: { status: string; publicId: string | null; storageKey: string | null } | null;
    companions: Array<{
      productId: string;
      productStatus: string;
      archived: boolean;
      styleId: string;
      styleStatus: string;
    }>;
  } | null;
}

export interface CompleteLookCsvExport {
  csv: string;
  rowCount: number;
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isExportable(source: CompleteLookRelationshipSource): boolean {
  const look = source.completeLook;
  if (
    source.archived || !hasText(source.productId) || !hasText(source.styleId) ||
    source.productStatus !== "READY" || source.styleStatus !== "READY" ||
    !look || look.status !== "READY" || look.imageAsset?.status !== "READY" ||
    !hasText(look.imageAsset.publicId) || !hasText(look.imageAsset.storageKey) ||
    look.companions.length === 0
  ) return false;

  const seenProductIds = new Set<string>();
  for (const companion of look.companions) {
    if (
      companion.archived || companion.productStatus !== "READY" || companion.styleStatus !== "READY" ||
      !hasText(companion.productId) || !hasText(companion.styleId) ||
      companion.productId === source.productId || seenProductIds.has(companion.productId)
    ) return false;
    seenProductIds.add(companion.productId);
  }
  return true;
}

export function buildCompleteLookCsv(sources: CompleteLookRelationshipSource[]): CompleteLookCsvExport {
  const uniqueByMainStyle = new Map<string, CompleteLookRelationshipSource>();
  for (const source of sources) {
    if (isExportable(source)) uniqueByMainStyle.set(source.styleId, source);
  }

  const eligible = [...uniqueByMainStyle.values()].sort((a, b) =>
    a.productId.localeCompare(b.productId) || a.styleId.localeCompare(b.styleId),
  );
  const rows = [createCsvRow([...COMPLETE_LOOK_CSV_COLUMNS])];
  for (const source of eligible) {
    const related = source.completeLook!.companions.slice(0, 3).map((companion) => `${companion.productId}__${companion.styleId}`);
    rows.push(createCsvRow([`${source.productId}__${source.styleId}`, ...related, ...Array(Math.max(0, 3 - related.length)).fill("")]));
  }
  return { csv: `${rows.join("\r\n")}\r\n`, rowCount: eligible.length };
}
