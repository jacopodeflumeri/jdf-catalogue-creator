-- CreateEnum
CREATE TYPE "CatalogDepartment" AS ENUM ('WOMEN', 'MEN');

-- CreateEnum
CREATE TYPE "CatalogEntityStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "CatalogAvailability" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK');

-- CreateEnum
CREATE TYPE "CatalogImageRole" AS ENUM ('FRONT', 'BACK', 'ON_MODEL');

-- CreateEnum
CREATE TYPE "CatalogImageStatus" AS ENUM ('QUEUED', 'GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "CatalogJobType" AS ENUM ('INITIAL', 'ADD_PRODUCTS', 'RETRY', 'REGENERATE_IMAGE');

-- CreateEnum
CREATE TYPE "CatalogDepartmentMode" AS ENUM ('AUTO', 'WOMEN', 'MEN');

-- CreateEnum
CREATE TYPE "CatalogJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CatalogJobStage" AS ENUM ('PLANNING', 'PRODUCTS', 'IMAGES', 'VALIDATING', 'COMPLETE');

-- CreateEnum
CREATE TYPE "CatalogTaskType" AS ENUM ('GENERATE_PRODUCT', 'GENERATE_IMAGE', 'VALIDATE_PRODUCT');

-- CreateEnum
CREATE TYPE "CatalogTaskStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "synthetic_catalog" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "brand_name" TEXT NOT NULL,
    "external_prefix" TEXT NOT NULL,
    "config_json" JSONB NOT NULL,
    "default_text_model" TEXT NOT NULL,
    "default_image_model" TEXT NOT NULL,
    "next_product_sequence" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "synthetic_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "synthetic_product" (
    "id" SERIAL NOT NULL,
    "catalog_id" INTEGER NOT NULL,
    "generation_job_id" INTEGER,
    "sequence" INTEGER NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "department" "CatalogDepartment" NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "base_price" DECIMAL(12,2) NOT NULL,
    "sale_price" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "product_url" TEXT,
    "status" "CatalogEntityStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "synthetic_product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "synthetic_style" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "external_id" TEXT NOT NULL,
    "color_name" TEXT NOT NULL,
    "color_code" TEXT NOT NULL,
    "visual_spec" JSONB,
    "status" "CatalogEntityStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "synthetic_style_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "synthetic_variant" (
    "id" SERIAL NOT NULL,
    "style_id" INTEGER NOT NULL,
    "external_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "availability" "CatalogAvailability" NOT NULL DEFAULT 'OUT_OF_STOCK',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "synthetic_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "synthetic_image_asset" (
    "id" SERIAL NOT NULL,
    "public_id" TEXT NOT NULL,
    "style_id" INTEGER NOT NULL,
    "role" "CatalogImageRole" NOT NULL,
    "status" "CatalogImageStatus" NOT NULL DEFAULT 'QUEUED',
    "storage_key" TEXT,
    "mime_type" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "model" TEXT,
    "prompt" TEXT,
    "reference_asset_id" INTEGER,
    "error_message" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "synthetic_image_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_generation_job" (
    "id" SERIAL NOT NULL,
    "public_id" TEXT NOT NULL,
    "catalog_id" INTEGER NOT NULL,
    "created_by_mapp_team_id" INTEGER,
    "job_type" "CatalogJobType" NOT NULL,
    "requested_products" INTEGER NOT NULL,
    "department_mode" "CatalogDepartmentMode" NOT NULL DEFAULT 'AUTO',
    "text_model" TEXT NOT NULL,
    "image_model" TEXT NOT NULL,
    "status" "CatalogJobStatus" NOT NULL DEFAULT 'QUEUED',
    "stage" "CatalogJobStage" NOT NULL DEFAULT 'PLANNING',
    "completed_products" INTEGER NOT NULL DEFAULT 0,
    "failed_products" INTEGER NOT NULL DEFAULT 0,
    "completed_images" INTEGER NOT NULL DEFAULT 0,
    "failed_images" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_generation_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_generation_task" (
    "id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "style_id" INTEGER,
    "image_asset_id" INTEGER,
    "task_type" "CatalogTaskType" NOT NULL,
    "status" "CatalogTaskStatus" NOT NULL DEFAULT 'QUEUED',
    "dedupe_key" TEXT NOT NULL,
    "payload" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "last_error" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_generation_task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "synthetic_catalog_slug_key" ON "synthetic_catalog"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "synthetic_catalog_external_prefix_key" ON "synthetic_catalog"("external_prefix");

-- CreateIndex
CREATE INDEX "synthetic_catalog_active_idx" ON "synthetic_catalog"("active");

-- CreateIndex
CREATE UNIQUE INDEX "synthetic_product_external_id_key" ON "synthetic_product"("external_id");

-- CreateIndex
CREATE INDEX "synthetic_product_catalog_id_department_idx" ON "synthetic_product"("catalog_id", "department");

-- CreateIndex
CREATE INDEX "synthetic_product_generation_job_id_idx" ON "synthetic_product"("generation_job_id");

-- CreateIndex
CREATE INDEX "synthetic_product_status_idx" ON "synthetic_product"("status");

-- CreateIndex
CREATE UNIQUE INDEX "synthetic_product_catalog_id_sequence_key" ON "synthetic_product"("catalog_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "synthetic_style_external_id_key" ON "synthetic_style"("external_id");

-- CreateIndex
CREATE INDEX "synthetic_style_product_id_idx" ON "synthetic_style"("product_id");

-- CreateIndex
CREATE INDEX "synthetic_style_status_idx" ON "synthetic_style"("status");

-- CreateIndex
CREATE UNIQUE INDEX "synthetic_style_product_id_color_code_key" ON "synthetic_style"("product_id", "color_code");

-- CreateIndex
CREATE UNIQUE INDEX "synthetic_variant_external_id_key" ON "synthetic_variant"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "synthetic_variant_sku_key" ON "synthetic_variant"("sku");

-- CreateIndex
CREATE INDEX "synthetic_variant_style_id_idx" ON "synthetic_variant"("style_id");

-- CreateIndex
CREATE INDEX "synthetic_variant_availability_idx" ON "synthetic_variant"("availability");

-- CreateIndex
CREATE UNIQUE INDEX "synthetic_variant_style_id_size_key" ON "synthetic_variant"("style_id", "size");

-- CreateIndex
CREATE UNIQUE INDEX "synthetic_image_asset_public_id_key" ON "synthetic_image_asset"("public_id");

-- CreateIndex
CREATE INDEX "synthetic_image_asset_status_idx" ON "synthetic_image_asset"("status");

-- CreateIndex
CREATE INDEX "synthetic_image_asset_reference_asset_id_idx" ON "synthetic_image_asset"("reference_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "synthetic_image_asset_style_id_role_key" ON "synthetic_image_asset"("style_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_generation_job_public_id_key" ON "catalog_generation_job"("public_id");

-- CreateIndex
CREATE INDEX "catalog_generation_job_catalog_id_created_at_idx" ON "catalog_generation_job"("catalog_id", "created_at");

-- CreateIndex
CREATE INDEX "catalog_generation_job_status_created_at_idx" ON "catalog_generation_job"("status", "created_at");

-- CreateIndex
CREATE INDEX "catalog_generation_job_created_by_mapp_team_id_idx" ON "catalog_generation_job"("created_by_mapp_team_id");

-- CreateIndex
CREATE INDEX "catalog_generation_task_status_available_at_idx" ON "catalog_generation_task"("status", "available_at");

-- CreateIndex
CREATE INDEX "catalog_generation_task_job_id_status_idx" ON "catalog_generation_task"("job_id", "status");

-- CreateIndex
CREATE INDEX "catalog_generation_task_product_id_idx" ON "catalog_generation_task"("product_id");

-- CreateIndex
CREATE INDEX "catalog_generation_task_style_id_idx" ON "catalog_generation_task"("style_id");

-- CreateIndex
CREATE INDEX "catalog_generation_task_image_asset_id_idx" ON "catalog_generation_task"("image_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_generation_task_job_id_dedupe_key_key" ON "catalog_generation_task"("job_id", "dedupe_key");

-- AddForeignKey
ALTER TABLE "synthetic_product" ADD CONSTRAINT "synthetic_product_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "synthetic_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "synthetic_product" ADD CONSTRAINT "synthetic_product_generation_job_id_fkey" FOREIGN KEY ("generation_job_id") REFERENCES "catalog_generation_job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "synthetic_style" ADD CONSTRAINT "synthetic_style_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "synthetic_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "synthetic_variant" ADD CONSTRAINT "synthetic_variant_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "synthetic_style"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "synthetic_image_asset" ADD CONSTRAINT "synthetic_image_asset_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "synthetic_style"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "synthetic_image_asset" ADD CONSTRAINT "synthetic_image_asset_reference_asset_id_fkey" FOREIGN KEY ("reference_asset_id") REFERENCES "synthetic_image_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_generation_job" ADD CONSTRAINT "catalog_generation_job_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "synthetic_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_generation_job" ADD CONSTRAINT "catalog_generation_job_created_by_mapp_team_id_fkey" FOREIGN KEY ("created_by_mapp_team_id") REFERENCES "mapp_team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_generation_task" ADD CONSTRAINT "catalog_generation_task_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "catalog_generation_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_generation_task" ADD CONSTRAINT "catalog_generation_task_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "synthetic_product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_generation_task" ADD CONSTRAINT "catalog_generation_task_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "synthetic_style"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_generation_task" ADD CONSTRAINT "catalog_generation_task_image_asset_id_fkey" FOREIGN KEY ("image_asset_id") REFERENCES "synthetic_image_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
