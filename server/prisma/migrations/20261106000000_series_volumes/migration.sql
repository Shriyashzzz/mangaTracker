-- CreateTable
CREATE TABLE "series_volumes" (
    "key" VARCHAR(200) NOT NULL,
    "volumes" JSONB NOT NULL,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "series_volumes_pkey" PRIMARY KEY ("key")
);
