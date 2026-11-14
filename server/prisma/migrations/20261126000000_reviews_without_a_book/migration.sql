-- A reader can rate and review a volume we have no book for (it's past the
-- end of our list, or in a gap). Such a review is kept by its series and
-- volume number, with no ISBN, until a book for that volume turns up and it
-- is given that book's (reviews/reviews.ts attachNoBookReviews).
-- The ISBN column may now be empty, and there's an index for finding a
-- reader's reviews of a series. Nothing already saved changes.
ALTER TABLE "volume_reviews" ALTER COLUMN "isbn13" DROP NOT NULL;
CREATE INDEX "volume_reviews_user_id_series_slug_idx" ON "volume_reviews"("user_id", "series_slug");
