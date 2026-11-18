-- When a person last opened a volume's page (never a search engine's visit):
-- the background pricing keeps these fresh before the volumes nobody opens
-- (collector/filler.ts staleQueue)
ALTER TABLE "books" ADD COLUMN "opened_at" TIMESTAMPTZ(6);
CREATE INDEX "books_opened_at_idx" ON "books"("opened_at");
