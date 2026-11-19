-- A password reset is sent to the recovery email (users.recovery_email), the
-- one email an account has. The separate email column, added a migration
-- ago and never filled, goes.

-- DropIndex
DROP INDEX "users_email_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "email";
