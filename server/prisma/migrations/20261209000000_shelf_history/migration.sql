-- A dated history of each shelf, for the reader's year in manga: series
-- added (or imported), volumes ticked and unticked, chapters and volumes
-- read, series finished. Written by the database itself whenever a shelf
-- entry changes, so every way of changing one (the page, offline changes,
-- books, edits, imports, merges) is recorded the same way.
--
--   kind       volume                amount
--   added      -                     volumes owned when it was added
--   imported   -                     the same, from an import
--   owned      the volume            1 ticked, -1 taken off
--   chapters   the chapter now       chapters moved (negative going back)
--   volumes    the volume read now   volumes moved (negative going back)
--   finished   -                     1 finished, -1 back to reading
--
-- A series deleted keeps its history (manga_id cleared, its name kept).
CREATE TABLE IF NOT EXISTS "shelf_events" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "manga_id" INTEGER,
  "series" VARCHAR(200) NOT NULL,
  "kind" VARCHAR(20) NOT NULL,
  "volume" DOUBLE PRECISION,
  "amount" INTEGER NOT NULL DEFAULT 1,
  "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shelf_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "shelf_events_manga_id_fkey" FOREIGN KEY ("manga_id") REFERENCES "manga"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "shelf_events_user_id_at_idx" ON "shelf_events"("user_id", "at");

-- the volumes a shelf entry owns: its list, or 1 to volumes_owned
-- (server/src/util/shelf/ownedList.ts)
CREATE OR REPLACE FUNCTION shelf_owned(list DOUBLE PRECISION[], up_to SMALLINT)
RETURNS DOUBLE PRECISION[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN cardinality(list) > 0 THEN list
    ELSE COALESCE((SELECT array_agg(v::double precision) FROM generate_series(1, COALESCE(up_to, 0)) v), '{}')
  END
$$;

CREATE OR REPLACE FUNCTION shelf_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  was DOUBLE PRECISION[];
  now_owned DOUBLE PRECISION[];
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  now_owned := shelf_owned(NEW.owned_list, NEW.volumes_owned);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO shelf_events (user_id, manga_id, series, kind, amount)
    VALUES (NEW.user_id, NEW.id, left(NEW.name, 200), 'added', cardinality(now_owned));
    RETURN NEW;
  END IF;

  was := shelf_owned(OLD.owned_list, OLD.volumes_owned);
  IF now_owned IS DISTINCT FROM was THEN
    INSERT INTO shelf_events (user_id, manga_id, series, kind, volume, amount)
    SELECT NEW.user_id, NEW.id, left(NEW.name, 200), 'owned', v, 1
      FROM unnest(now_owned) v WHERE NOT (v = ANY (was))
    UNION ALL
    SELECT NEW.user_id, NEW.id, left(NEW.name, 200), 'owned', v, -1
      FROM unnest(was) v WHERE NOT (v = ANY (now_owned));
  END IF;

  IF COALESCE(NEW.bookmark, 0) <> COALESCE(OLD.bookmark, 0) THEN
    INSERT INTO shelf_events (user_id, manga_id, series, kind, volume, amount)
    VALUES (NEW.user_id, NEW.id, left(NEW.name, 200), 'chapters', NEW.bookmark,
            COALESCE(NEW.bookmark, 0) - COALESCE(OLD.bookmark, 0));
  END IF;

  IF COALESCE(NEW.read_volume, 0) <> COALESCE(OLD.read_volume, 0) THEN
    INSERT INTO shelf_events (user_id, manga_id, series, kind, volume, amount)
    VALUES (NEW.user_id, NEW.id, left(NEW.name, 200), 'volumes', NEW.read_volume,
            COALESCE(NEW.read_volume, 0) - COALESCE(OLD.read_volume, 0));
  END IF;

  IF NEW.status <> OLD.status THEN
    INSERT INTO shelf_events (user_id, manga_id, series, kind, amount)
    VALUES (NEW.user_id, NEW.id, left(NEW.name, 200), 'finished', CASE WHEN NEW.status THEN 1 ELSE -1 END);
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS "manga_shelf_history" ON "manga";
CREATE TRIGGER "manga_shelf_history"
  AFTER INSERT OR UPDATE OF owned_list, volumes_owned, bookmark, read_volume, status ON "manga"
  FOR EACH ROW EXECUTE FUNCTION shelf_history();
