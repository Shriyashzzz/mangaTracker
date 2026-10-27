-- v1 grew its schema in steps (initdb, initPrices, migrate, initPrefs), and
-- older databases missed some of them. `db:baseline` marks 0_init as applied
-- without running it, so this fills in anything such a database lacks.
-- Every statement is a no-op where the object already exists.

-- users.prefs (v1 initPrefs / migrate)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "prefs" JSONB NOT NULL DEFAULT '{}';

-- manga.volumes_owned (v1 migrate)
ALTER TABLE "manga" ADD COLUMN IF NOT EXISTS "volumes_owned" SMALLINT;

-- the price checker's tables (v1 initPrices, added to over time)
CREATE TABLE IF NOT EXISTS "books" (
    "isbn13" CHAR(13) NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT,
    "publisher" TEXT,
    "cover_url" TEXT,
    "year" SMALLINT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "books_pkey" PRIMARY KEY ("isbn13")
);

CREATE TABLE IF NOT EXISTS "price_samples" (
    "id" BIGSERIAL NOT NULL,
    "isbn13" CHAR(13) NOT NULL REFERENCES "books"("isbn13") ON DELETE CASCADE,
    "store" VARCHAR(60) NOT NULL,
    "format" VARCHAR(20) NOT NULL DEFAULT 'print',
    "condition" VARCHAR(20) NOT NULL DEFAULT 'new',
    "price_cents" INTEGER NOT NULL CHECK ("price_cents" >= 0),
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "in_stock" BOOLEAN NOT NULL DEFAULT true,
    "url" TEXT,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "price_samples_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "price_samples_isbn_time" ON "price_samples"("isbn13", "fetched_at" DESC);

CREATE TABLE IF NOT EXISTS "price_checks" (
    "isbn13" CHAR(13) NOT NULL REFERENCES "books"("isbn13") ON DELETE CASCADE,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "price_checks_pkey" PRIMARY KEY ("isbn13")
);

CREATE TABLE IF NOT EXISTS "series_info" (
    "slug" VARCHAR(80) NOT NULL,
    "info" JSONB,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "series_info_pkey" PRIMARY KEY ("slug")
);

CREATE TABLE IF NOT EXISTS "api_usage" (
    "provider" VARCHAR(40) NOT NULL,
    "month" DATE NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "api_usage_pkey" PRIMARY KEY ("provider", "month")
);

CREATE TABLE IF NOT EXISTS "edition_covers" (
    "isbn13" CHAR(13) NOT NULL,
    "cover_id" INTEGER,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "edition_covers_pkey" PRIMARY KEY ("isbn13")
);
