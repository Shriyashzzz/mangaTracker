-- Canadian prices, kept apart from the US ones: their own checks and samples, so
-- nothing about US prices, history or filters can be touched by them.
CREATE TABLE "ca_price_checks" (
    "isbn13" CHAR(13) NOT NULL,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "ca_price_checks_pkey" PRIMARY KEY ("isbn13")
);

CREATE TABLE "ca_price_samples" (
    "id" BIGSERIAL NOT NULL,
    "isbn13" CHAR(13) NOT NULL,
    "store" VARCHAR(60) NOT NULL,
    "format" VARCHAR(20) NOT NULL DEFAULT 'print',
    "condition" VARCHAR(20) NOT NULL DEFAULT 'new',
    "price_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'CAD',
    "in_stock" BOOLEAN NOT NULL DEFAULT true,
    "url" TEXT,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ca_price_samples_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ca_price_samples_isbn13_fetched_at_idx" ON "ca_price_samples"("isbn13", "fetched_at" DESC);
