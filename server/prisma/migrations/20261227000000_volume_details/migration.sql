-- CreateTable
CREATE TABLE "volume_details" (
    "isbn13" CHAR(13) NOT NULL,
    "description" TEXT,
    "pages" INTEGER,
    "published" VARCHAR(10),
    "source" VARCHAR(20) NOT NULL,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "volume_details_pkey" PRIMARY KEY ("isbn13")
);

