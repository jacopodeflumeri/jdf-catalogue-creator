export const DEFAULT_LARGE_JOB_THRESHOLD = 25;

interface GenerationSettingsEnvironment {
  CATALOG_LARGE_JOB_THRESHOLD?: string;
}

export interface CatalogGenerationSettings {
  largeJobThreshold: number;
}

function positiveSafeInteger(value: string | undefined, fallback: number, name: string): number {
  if (value == null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return parsed;
}

export function getCatalogGenerationSettings(
  environment: GenerationSettingsEnvironment = {
    CATALOG_LARGE_JOB_THRESHOLD: process.env.CATALOG_LARGE_JOB_THRESHOLD,
  },
): CatalogGenerationSettings {
  return {
    largeJobThreshold: positiveSafeInteger(
      environment.CATALOG_LARGE_JOB_THRESHOLD,
      DEFAULT_LARGE_JOB_THRESHOLD,
      "CATALOG_LARGE_JOB_THRESHOLD",
    ),
  };
}
