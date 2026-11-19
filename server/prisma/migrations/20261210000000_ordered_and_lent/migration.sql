-- Two collector's notes:
--   ordered_list   volumes ordered but not here yet (a preorder, a parcel on
--                  its way): Buy next goes past them. One stops being
--                  "ordered" the moment it's owned, whichever way it's ticked
--                  (the trigger below)
--   lent_to,       a book lent out: who has it, and since when
--   lent_on
ALTER TABLE "manga" ADD COLUMN IF NOT EXISTS "ordered_list" DOUBLE PRECISION[] NOT NULL DEFAULT '{}';
ALTER TABLE "owned_books" ADD COLUMN IF NOT EXISTS "lent_to" VARCHAR(40);
ALTER TABLE "owned_books" ADD COLUMN IF NOT EXISTS "lent_on" DATE;

-- owned now: no longer ordered (shelf_owned is from 20261209000000)
CREATE OR REPLACE FUNCTION manga_arrived() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF cardinality(NEW.ordered_list) > 0 THEN
    NEW.ordered_list := COALESCE((
      SELECT array_agg(v ORDER BY v) FROM unnest(NEW.ordered_list) v
      WHERE NOT (v = ANY (shelf_owned(NEW.owned_list, NEW.volumes_owned)))
    ), '{}');
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS "manga_arrived" ON "manga";
CREATE TRIGGER "manga_arrived"
  BEFORE INSERT OR UPDATE OF owned_list, volumes_owned, ordered_list ON "manga"
  FOR EACH ROW EXECUTE FUNCTION manga_arrived();
