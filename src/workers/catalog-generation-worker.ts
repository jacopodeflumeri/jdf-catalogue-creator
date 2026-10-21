import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

// Set process-specific validation and signal ownership before loading modules
// that initialize Prisma or validate feature configuration. ECS also declares
// these values explicitly; the defaults make `npm run worker` behave the same.
process.env.PROCESS_ROLE ??= "catalog-worker";
process.env.PRISMA_MANAGES_PROCESS_SIGNALS = "false";

const [
  { prisma },
  { default: logger },
  { LiteLLMImageGenerator },
  { LiteLLMProductGenerator },
  { CatalogGenerationWorker },
  { S3GeneratedAssetStorage },
] = await Promise.all([
  import("@/lib/prisma/client"),
  import("@/lib/utils/logger"),
  import("@/modules/synthetic_catalog/providers/litellm-image-generator"),
  import("@/modules/synthetic_catalog/providers/litellm-product-generator"),
  import("@/modules/synthetic_catalog/server/catalog-worker"),
  import("@/modules/synthetic_catalog/storage/generated-asset-storage"),
]);

const abortController = new AbortController();
const requestStop = () => abortController.abort();
process.once("SIGINT", requestStop);
process.once("SIGTERM", requestStop);

const workerId = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
const worker = new CatalogGenerationWorker(
  {
    // Durable task attempts own retries here. Keeping provider-local attempts at
    // one avoids multiplying three task attempts into nine billable calls.
    productGenerator: new LiteLLMProductGenerator({ maxAttempts: 1 }),
    imageGenerator: new LiteLLMImageGenerator({ maxAttempts: 1 }),
    storage: new S3GeneratedAssetStorage(),
  },
  { workerId },
);

worker
  .start(abortController.signal)
  .catch((error) => {
    logger.error("Catalog generation worker stopped unexpectedly", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
