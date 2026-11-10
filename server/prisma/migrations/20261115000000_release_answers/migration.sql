-- CreateTable
CREATE TABLE "release_answers" (
    "manga_id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "answer" JSONB NOT NULL,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "release_answers_pkey" PRIMARY KEY ("manga_id")
);

-- AddForeignKey
ALTER TABLE "release_answers" ADD CONSTRAINT "release_answers_manga_id_fkey" FOREIGN KEY ("manga_id") REFERENCES "manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;
