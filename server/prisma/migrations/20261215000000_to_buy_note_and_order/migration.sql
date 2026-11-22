-- a reader's own note on a To buy item ("wait for a sale"), and their own
-- order for the list (position; null until they first move one)
ALTER TABLE "to_buy" ADD COLUMN "note" VARCHAR(140);
ALTER TABLE "to_buy" ADD COLUMN "position" INTEGER;
