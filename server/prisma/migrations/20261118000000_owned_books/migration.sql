-- the books behind a shelf entry's owned volumes: one row per book they have,
-- with its ISBN, its edition (single, omnibus, deluxe, boxset), its number in
-- that edition and the volumes it holds. A new table only: the owned volumes
-- on manga stay as they are, and a volume ticked by hand has no book.
CREATE TABLE "owned_books" (
    "id" SERIAL NOT NULL,
    "manga_id" INTEGER NOT NULL,
    "isbn13" VARCHAR(13),
    "edition" VARCHAR(12) NOT NULL DEFAULT 'single',
    "number" DOUBLE PRECISION,
    "title" VARCHAR(200),
    "volumes" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],

    CONSTRAINT "owned_books_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "owned_books_manga_id_idx" ON "owned_books"("manga_id");
ALTER TABLE "owned_books" ADD CONSTRAINT "owned_books_manga_id_fkey" FOREIGN KEY ("manga_id") REFERENCES "manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;
