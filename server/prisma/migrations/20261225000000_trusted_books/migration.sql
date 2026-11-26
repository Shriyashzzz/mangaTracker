-- CreateTable
CREATE TABLE "trusted_books" (
    "isbn13" CHAR(13) NOT NULL,
    "isbn10" CHAR(10),
    "source" VARCHAR(40) NOT NULL,
    "trust" SMALLINT NOT NULL,
    "series" VARCHAR(200) NOT NULL,
    "series_key" VARCHAR(200) NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "volume" DOUBLE PRECISION,
    "holds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "title" VARCHAR(300) NOT NULL,
    "publisher" VARCHAR(120),
    "published" VARCHAR(10),
    "pages" INTEGER,
    "description" TEXT,
    "list_cents" INTEGER,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trusted_books_pkey" PRIMARY KEY ("isbn13")
);

-- CreateTable
CREATE TABLE "isbn_swaps" (
    "from_isbn" CHAR(13) NOT NULL,
    "to_isbn" CHAR(13) NOT NULL,
    "series_key" VARCHAR(200) NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "swapped_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "isbn_swaps_pkey" PRIMARY KEY ("from_isbn")
);

-- CreateIndex
CREATE INDEX "trusted_books_series_key_idx" ON "trusted_books"("series_key");

-- CreateIndex
CREATE INDEX "isbn_swaps_to_isbn_idx" ON "isbn_swaps"("to_isbn");

