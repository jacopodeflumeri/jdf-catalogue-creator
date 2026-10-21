export const DEFAULT_MAX_PRODUCTS_PER_JOB = 100;
export const HARD_MAX_PRODUCTS_PER_JOB = 500;
export const DEFAULT_LARGE_JOB_THRESHOLD = 25;

interface GenerationLimitEnvironment {
  CATALOG_MAX_PRODUCTS_PER_JOB?: string;
  CATALOG_LARGE_JOB_THRESHOLD?: string;
}

export interface CatalogGenerationLimits {
  maxProductsPerJob: number;
  largeJobThreshold: number;
}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value == null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function getCatalogGenerationLimits(
  environment: GenerationLimitEnvironment = {
    CATALOG_MAX_PRODUCTS_PER_JOB: process.env.CATALOG_MAX_PRODUCTS_PER_JOB,
    CATALOG_LARGE_JOB_THRESHOLD: process.env.CATALOG_LARGE_JOB_THRESHOLD,
  },
): CatalogGenerationLimits {
  const maxProductsPerJob = positiveInteger(
    environment.CATALOG_MAX_PRODUCTS_PER_JOB,
    DEFAULT_MAX_PRODUCTS_PER_JOB,
    "CATALOG_MAX_PRODUCTS_PER_JOB",
  );
  if (maxProductsPerJob > HARD_MAX_PRODUCTS_PER_JOB) {
    throw new Error(
      `CATALOG_MAX_PRODUCTS_PER_JOB cannot exceed the safety ceiling of ${HARD_MAX_PRODUCTS_PER_JOB}`,
    );
  }
  const largeJobThreshold = positiveInteger(
    environment.CATALOG_LARGE_JOB_THRESHOLD,
    Math.min(DEFAULT_LARGE_JOB_THRESHOLD, maxProductsPerJob),
    "CATALOG_LARGE_JOB_THRESHOLD",
  );
  if (largeJobThreshold > maxProductsPerJob) {
    throw new Error("CATALOG_LARGE_JOB_THRESHOLD cannot exceed CATALOG_MAX_PRODUCTS_PER_JOB");
  }
  return { maxProductsPerJob, largeJobThreshold };
}
