-- Readers' reviews of a volume, and other readers' flags on them ("this is a
-- spoiler", "report"). Two new tables; nothing existing is changed.
CREATE TABLE "volume_reviews" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "isbn13" CHAR(13) NOT NULL,
    "series_slug" VARCHAR(80) NOT NULL,
    "volume" DOUBLE PRECISION,
    "rating" SMALLINT NOT NULL,
    "body" VARCHAR(500) NOT NULL DEFAULT '',
    "spoiler" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(10) NOT NULL DEFAULT 'shown',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "volume_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "volume_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

-- one review of a volume from each reader
CREATE UNIQUE INDEX "volume_reviews_user_id_isbn13_key" ON "volume_reviews"("user_id", "isbn13");
CREATE INDEX "volume_reviews_isbn13_status_idx" ON "volume_reviews"("isbn13", "status");
CREATE INDEX "volume_reviews_series_slug_status_idx" ON "volume_reviews"("series_slug", "status");

ALTER TABLE "volume_reviews" ADD CONSTRAINT "volume_reviews_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE TABLE "review_flags" (
    "id" SERIAL NOT NULL,
    "review_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_flags_pkey" PRIMARY KEY ("id")
);

-- a reader flags a review once for each reason
CREATE UNIQUE INDEX "review_flags_review_id_user_id_kind_key" ON "review_flags"("review_id", "user_id", "kind");

ALTER TABLE "review_flags" ADD CONSTRAINT "review_flags_review_id_fkey"
    FOREIGN KEY ("review_id") REFERENCES "volume_reviews"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "review_flags" ADD CONSTRAINT "review_flags_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
