/*
  Warnings:

  - You are about to drop the column `token` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `token_expiry` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[reset_token]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "token",
DROP COLUMN "token_expiry",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "reset_token" TEXT,
ADD COLUMN     "reset_token_expiry" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_reset_token_key" ON "users"("reset_token");
