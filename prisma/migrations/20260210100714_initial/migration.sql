-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "mapp" BOOLEAN,
    "account" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapp_team" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "firstname" TEXT,
    "lastname" TEXT,
    "title" TEXT,
    "role" TEXT,
    "location" TEXT,
    "image" JSONB,
    "access_status" TEXT NOT NULL DEFAULT 'pending',
    "access_level" TEXT NOT NULL DEFAULT 'viewer',
    "last_login_at" TIMESTAMP(3),
    "authorized_by" INTEGER,
    "authorized_at" TIMESTAMP(3),
    "access_notes" TEXT,

    CONSTRAINT "mapp_team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "company_name" TEXT,
    "sf_account_id" TEXT,
    "region" TEXT,
    "currency" TEXT,
    "vertical" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Prospect',
    "stage" TEXT NOT NULL DEFAULT 'Discovery',
    "domains" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_user" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "access" TEXT NOT NULL DEFAULT 'customer',
    "first_name" TEXT,
    "last_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_data" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_activity" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" INTEGER NOT NULL,
    "account_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "details" TEXT,
    "message" TEXT,
    "linked_id" INTEGER,
    "mapp_user_id" INTEGER,

    CONSTRAINT "account_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_notifications" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "account_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "data" JSONB NOT NULL,
    "status" TEXT,

    CONSTRAINT "account_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magic_link" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "magic_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_account_idx" ON "user"("account");

-- CreateIndex
CREATE INDEX "user_created_at_idx" ON "user"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "mapp_team_email_key" ON "mapp_team"("email");

-- CreateIndex
CREATE INDEX "mapp_team_email_idx" ON "mapp_team"("email");

-- CreateIndex
CREATE INDEX "mapp_team_access_status_idx" ON "mapp_team"("access_status");

-- CreateIndex
CREATE INDEX "mapp_team_access_level_idx" ON "mapp_team"("access_level");

-- CreateIndex
CREATE INDEX "account_sf_account_id_idx" ON "account"("sf_account_id");

-- CreateIndex
CREATE INDEX "account_status_idx" ON "account"("status");

-- CreateIndex
CREATE INDEX "account_stage_idx" ON "account"("stage");

-- CreateIndex
CREATE INDEX "account_created_at_idx" ON "account"("created_at");

-- CreateIndex
CREATE INDEX "account_user_user_id_idx" ON "account_user"("user_id");

-- CreateIndex
CREATE INDEX "account_user_status_idx" ON "account_user"("status");

-- CreateIndex
CREATE UNIQUE INDEX "account_user_account_id_user_id_key" ON "account_user"("account_id", "user_id");

-- CreateIndex
CREATE INDEX "account_data_account_id_type_idx" ON "account_data"("account_id", "type");

-- CreateIndex
CREATE INDEX "account_activity_account_id_idx" ON "account_activity"("account_id");

-- CreateIndex
CREATE INDEX "account_activity_user_id_idx" ON "account_activity"("user_id");

-- CreateIndex
CREATE INDEX "account_activity_created_at_idx" ON "account_activity"("created_at");

-- CreateIndex
CREATE INDEX "account_notifications_account_id_idx" ON "account_notifications"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "magic_link_token_key" ON "magic_link"("token");

-- CreateIndex
CREATE INDEX "magic_link_email_idx" ON "magic_link"("email");

-- CreateIndex
CREATE INDEX "magic_link_expires_at_idx" ON "magic_link"("expires_at");

-- CreateIndex
CREATE INDEX "magic_link_used_idx" ON "magic_link"("used");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_account_fkey" FOREIGN KEY ("account") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapp_team" ADD CONSTRAINT "mapp_team_authorized_by_fkey" FOREIGN KEY ("authorized_by") REFERENCES "mapp_team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_user" ADD CONSTRAINT "account_user_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_user" ADD CONSTRAINT "account_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_data" ADD CONSTRAINT "account_data_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_data" ADD CONSTRAINT "account_data_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_activity" ADD CONSTRAINT "account_activity_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_activity" ADD CONSTRAINT "account_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_activity" ADD CONSTRAINT "account_activity_mapp_user_id_fkey" FOREIGN KEY ("mapp_user_id") REFERENCES "mapp_team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_notifications" ADD CONSTRAINT "account_notifications_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_notifications" ADD CONSTRAINT "account_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
