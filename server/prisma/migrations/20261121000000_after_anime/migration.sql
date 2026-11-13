-- "Where does the anime leave off?": what MangaUpdates says for a series, and
-- readers' corrections. Two new tables; nothing existing is changed.
CREATE TABLE "anime_stops" (
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "start_line" TEXT,
    "end_line" TEXT,
    "last_chapter" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "source_url" TEXT,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anime_stops_pkey" PRIMARY KEY ("slug")
);

CREATE TABLE "anime_fixes" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "chapter" DOUBLE PRECISION,
    "volume" INTEGER,
    "source" VARCHAR(500) NOT NULL,
    "note" VARCHAR(500),
    "status" VARCHAR(10) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(6),

    CONSTRAINT "anime_fixes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "anime_fixes_slug_status_idx" ON "anime_fixes"("slug", "status");
CREATE INDEX "anime_fixes_status_created_at_idx" ON "anime_fixes"("status", "created_at");
