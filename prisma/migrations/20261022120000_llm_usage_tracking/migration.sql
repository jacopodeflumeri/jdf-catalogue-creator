-- CreateEnum
CREATE TYPE "LlmUsageOperation" AS ENUM ('CHAT_COMPLETION', 'IMAGE_GENERATION', 'IMAGE_EDIT');

-- CreateEnum
CREATE TYPE "LlmCostBasis" AS ENUM ('TOKEN_USAGE', 'CATALOG_ESTIMATE', 'UNPRICED');

-- CreateTable
CREATE TABLE "llm_usage" (
    "id" SERIAL NOT NULL,
    "request_id" TEXT,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" "LlmUsageOperation" NOT NULL,
    "input_tokens" INTEGER,
    "cached_input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "text_input_tokens" INTEGER,
    "image_input_tokens" INTEGER,
    "text_output_tokens" INTEGER,
    "image_output_tokens" INTEGER,
    "estimated_cost_usd" DECIMAL(18,8),
    "cost_basis" "LlmCostBasis" NOT NULL,
    "pricing_snapshot" JSONB,
    "usage_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "llm_usage_created_at_idx" ON "llm_usage"("created_at");

-- CreateIndex
CREATE INDEX "llm_usage_model_created_at_idx" ON "llm_usage"("model", "created_at");

-- CreateIndex
CREATE INDEX "llm_usage_feature_created_at_idx" ON "llm_usage"("feature", "created_at");

-- CreateIndex
CREATE INDEX "llm_usage_operation_created_at_idx" ON "llm_usage"("operation", "created_at");
