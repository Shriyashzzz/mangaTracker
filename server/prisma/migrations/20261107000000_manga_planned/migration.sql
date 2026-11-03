-- A manga they want to read but haven't started: the To read list. Existing rows
-- are all being read or finished, so they start false.
ALTER TABLE "manga" ADD COLUMN "planned" BOOLEAN NOT NULL DEFAULT false;
