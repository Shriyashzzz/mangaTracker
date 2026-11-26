-- AlterTable
ALTER TABLE "trusted_books" ADD COLUMN     "ends" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "isbn_sightings" (
    "user_id" INTEGER NOT NULL,
    "isbn13" CHAR(13) NOT NULL,
    "series_key" VARCHAR(200) NOT NULL,
    "series" VARCHAR(200) NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "how" VARCHAR(10) NOT NULL,
    "seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "isbn_sightings_pkey" PRIMARY KEY ("user_id","isbn13")
);

-- CreateIndex
CREATE INDEX "isbn_sightings_isbn13_idx" ON "isbn_sightings"("isbn13");

-- AddForeignKey
ALTER TABLE "isbn_sightings" ADD CONSTRAINT "isbn_sightings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

