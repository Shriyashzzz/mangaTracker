-- Profile, optional recovery email and list sharing. All optional or off, so
-- existing accounts carry on exactly as they are.
ALTER TABLE "users" ADD COLUMN "display_name" VARCHAR(40);
ALTER TABLE "users" ADD COLUMN "avatar" VARCHAR(20);
ALTER TABLE "users" ADD COLUMN "recovery_email" VARCHAR(254);
ALTER TABLE "users" ADD COLUMN "share_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "share_notes" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "share_code" VARCHAR(16);
CREATE UNIQUE INDEX "users_share_code_key" ON "users"("share_code");
