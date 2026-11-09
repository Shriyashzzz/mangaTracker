-- Each price source checks a volume on its own schedule (eBay every few days,
-- the paid searches every few weeks), so every saved price says which source
-- group found it, and each group's last check of a volume is kept. A volume's
-- prices are each group's prices from that group's last check.
ALTER TABLE "price_samples" ADD COLUMN "source" VARCHAR(20);

CREATE TABLE "price_source_checks" (
    "isbn13" CHAR(13) NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "checked_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "price_source_checks_pkey" PRIMARY KEY ("isbn13", "source")
);

ALTER TABLE "price_source_checks" ADD CONSTRAINT "price_source_checks_isbn13_fkey"
    FOREIGN KEY ("isbn13") REFERENCES "books"("isbn13") ON DELETE CASCADE ON UPDATE NO ACTION;

-- prices saved before: their group from the store, which is how each source
-- names them (Google Shopping lists other stores too, so near enough; it only
-- decides which group's next check replaces the row)
UPDATE "price_samples" SET "source" = CASE
    WHEN "store" ILIKE 'ebay%' THEN 'ebay'
    WHEN "store" ILIKE 'amazon%' THEN 'amazon'
    WHEN "format" = 'ebook' THEN 'ebooks'
    WHEN "store" ILIKE 'walmart%' THEN 'walmart'
    ELSE 'shopping'
END;

-- each volume's latest check becomes the last check of every group in it, so
-- every page keeps showing exactly the prices it showed
INSERT INTO "price_source_checks" ("isbn13", "source", "checked_at")
SELECT DISTINCT pc."isbn13", ps."source", pc."checked_at"
FROM "price_checks" pc
JOIN "price_samples" ps ON ps."isbn13" = pc."isbn13" AND ps."fetched_at" = pc."checked_at"
ON CONFLICT DO NOTHING;

-- and every source that answered it, even with nothing found, so a volume
-- checked recently isn't looked at again before its time
INSERT INTO "price_source_checks" ("isbn13", "source", "checked_at")
SELECT pc."isbn13",
       CASE s.id
           WHEN 'serpapi' THEN 'shopping'
           WHEN 'serpapi-ebay' THEN 'ebay'
           WHEN 'ebay' THEN 'ebay'
           WHEN 'serpapi-amazon' THEN 'amazon'
           WHEN 'keepa' THEN 'amazon'
           WHEN 'google-books' THEN 'ebooks'
           WHEN 'walmart' THEN 'walmart'
           ELSE s.id
       END,
       pc."checked_at"
FROM "price_checks" pc, unnest(pc."sources") AS s(id)
ON CONFLICT DO NOTHING;
