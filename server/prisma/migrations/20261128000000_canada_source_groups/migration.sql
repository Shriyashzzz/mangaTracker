-- Canadian prices get source groups, like the US ones: every saved price says
-- which source found it (eBay.ca's own API, or Google Shopping in Canada), and
-- each group's last look at a volume is kept. So a background eBay.ca refresh
-- replaces only eBay.ca's prices and keeps Amazon.ca's, Indigo's and the rest.
ALTER TABLE "ca_price_samples" ADD COLUMN "source" VARCHAR(20);

CREATE TABLE "ca_price_source_checks" (
    "isbn13" CHAR(13) NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "checked_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ca_price_source_checks_pkey" PRIMARY KEY ("isbn13", "source")
);

-- prices saved before: eBay.ca's API named its rows "eBay.ca"; everything
-- else came through Google Shopping (its own "eBay" sellers included)
UPDATE "ca_price_samples"
SET "source" = CASE WHEN "store" = 'eBay.ca' THEN 'ebay' ELSE 'shopping' END;

-- every check so far asked both, so each volume's last check becomes the last
-- look of both groups: every page keeps showing exactly what it showed
INSERT INTO "ca_price_source_checks" ("isbn13", "source", "checked_at")
SELECT "isbn13", g."source", "checked_at"
FROM "ca_price_checks", (VALUES ('ebay'), ('shopping')) AS g("source")
ON CONFLICT DO NOTHING;
