-- The About page's "volumes priced" count (prices/pagesService.ts
-- getPricedCount) asks for every price found in the last 30 days, by time
-- alone. These let it read just those rows instead of the whole table.
CREATE INDEX IF NOT EXISTS "price_samples_fetched_at_idx" ON "price_samples"("fetched_at");
CREATE INDEX IF NOT EXISTS "ca_price_samples_fetched_at_idx" ON "ca_price_samples"("fetched_at");
