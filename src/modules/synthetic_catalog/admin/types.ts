export type CatalogJobStatusValue =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "COMPLETED_WITH_ERRORS"
  | "FAILED"
  | "CANCELLED";

export interface CatalogJobView {
  id: number;
  publicId: string;
  jobType: string;
  status: CatalogJobStatusValue;
  stage: string;
  requestedProducts: number;
  departmentMode: string;
  completedProducts: number;
  failedProducts: number;
  completedImages: number;
  failedImages: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  failedTaskDetails: Array<{
    id: number;
    taskType: string;
    reference: string;
    attempts: number;
    maxAttempts: number;
    lastError: string;
  }>;
}

export interface CatalogOverviewView {
  id: number;
  slug: string;
  name: string;
  segment: string;
  brandName: string;
  productCount: number;
  styleCount: number;
  variantCount: number;
  readyImageCount: number;
  failedImageCount: number;
  estimatedSizesPerProduct: number;
  maxProductsPerJob: number;
  largeJobThreshold: number;
  latestJob: CatalogJobView | null;
}

export interface CatalogImageView {
  id: number;
  publicId: string;
  role: "FRONT" | "BACK" | "ON_MODEL";
  status: "QUEUED" | "GENERATING" | "READY" | "FAILED";
  url: string | null;
  errorMessage: string | null;
}

export interface CatalogProductView {
  id: number;
  externalId: string;
  name: string;
  description: string;
  department: string;
  category: string;
  subcategory: string;
  material: string;
  season: string;
  basePrice: string;
  salePrice: string | null;
  currency: string;
  status: string;
  style: {
    id: number;
    externalId: string;
    colorName: string;
    colorCode: string;
    status: string;
    variants: Array<{
      id: number;
      externalId: string;
      sku: string;
      size: string;
      stock: number;
      availability: string;
    }>;
    images: CatalogImageView[];
  } | null;
}

export interface CatalogProductDetailView {
  catalog: {
    id: number;
    slug: string;
    name: string;
    segment: string;
    brandName: string;
  };
  product: CatalogProductView;
}

export interface CatalogDetailView {
  catalog: {
    id: number;
    slug: string;
    name: string;
    segment: string;
    brandName: string;
    externalPrefix: string;
    defaultTextModel: string;
    defaultImageModel: string;
    visualDirection: string;
    estimatedSizesPerProduct: number;
    maxProductsPerJob: number;
    largeJobThreshold: number;
  };
  counts: {
    products: number;
    styles: number;
    variants: number;
    readyImages: number;
    failedImages: number;
  };
  products: CatalogProductView[];
  jobs: CatalogJobView[];
}

export interface CatalogActionResult {
  ok: boolean;
  message?: string;
  jobId?: number;
}
