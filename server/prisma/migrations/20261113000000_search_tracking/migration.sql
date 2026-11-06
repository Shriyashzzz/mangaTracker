-- Who spends the SerpApi searches, and how big each shelf is.
--
-- manga_count: how many series are on each user's shelf. Filled in for
-- everyone now, then kept right by a trigger on every add and delete, so no
-- code path (imports, Select, undo, deleting the account) can forget it.
-- serpapi_searches: searches a signed-in user's visits have spent, from today.
ALTER TABLE "users"
  ADD COLUMN "manga_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "serpapi_searches" INTEGER NOT NULL DEFAULT 0;

UPDATE "users" u
SET "manga_count" = (SELECT count(*) FROM "manga" m WHERE m."user_id" = u."id");

CREATE FUNCTION manga_count_follow() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "users" SET "manga_count" = "manga_count" + 1 WHERE "id" = NEW."user_id";
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "users" SET "manga_count" = GREATEST("manga_count" - 1, 0) WHERE "id" = OLD."user_id";
  ELSIF NEW."user_id" IS DISTINCT FROM OLD."user_id" THEN
    UPDATE "users" SET "manga_count" = GREATEST("manga_count" - 1, 0) WHERE "id" = OLD."user_id";
    UPDATE "users" SET "manga_count" = "manga_count" + 1 WHERE "id" = NEW."user_id";
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER manga_count_follow
AFTER INSERT OR DELETE OR UPDATE OF "user_id" ON "manga"
FOR EACH ROW EXECUTE FUNCTION manga_count_follow();

-- searches spent by visitors who aren't signed in, one row per visitor a
-- month. visitor is a hash of their IP and browser with the server secret
-- (no IP is stored); user_agent is the browser they said they were, which is
-- how a bot that slipped past the crawler list shows itself
CREATE TABLE "guest_searches" (
  "visitor" CHAR(16) NOT NULL,
  "month" DATE NOT NULL,
  "searches" INTEGER NOT NULL DEFAULT 0,
  "user_agent" VARCHAR(300),
  "last_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "guest_searches_pkey" PRIMARY KEY ("visitor", "month")
);
