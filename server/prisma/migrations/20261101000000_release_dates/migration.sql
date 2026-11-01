-- what MangaDex said about a series' releases, kept 6 hours
CREATE TABLE "release_dates" (
    "slug" VARCHAR(160) NOT NULL,
    "data" JSONB NOT NULL,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "release_dates_pkey" PRIMARY KEY ("slug")
);
