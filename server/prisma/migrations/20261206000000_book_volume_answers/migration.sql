-- What a reader said a book holds, for an edition the app couldn't work out
-- ("Which volumes are in this book?"). Theirs at once; shared with everyone
-- once three readers say the same (util/shelf/bookVolumeAnswers.ts).
-- Deleted with the account.
CREATE TABLE "book_volume_answers" (
    "user_id" INTEGER NOT NULL,
    "isbn13" CHAR(13) NOT NULL,
    "volumes" DOUBLE PRECISION[] NOT NULL,
    "answered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_volume_answers_pkey" PRIMARY KEY ("user_id","isbn13")
);

CREATE INDEX "book_volume_answers_isbn13_idx" ON "book_volume_answers"("isbn13");

ALTER TABLE "book_volume_answers" ADD CONSTRAINT "book_volume_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
