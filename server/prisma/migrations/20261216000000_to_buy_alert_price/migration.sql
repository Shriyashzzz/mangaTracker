-- A price the reader names for a volume on their To buy list: an alert goes
-- to their phone when a copy is at or under it. Null: no price named
ALTER TABLE "to_buy" ADD COLUMN "alert_cents" INTEGER;
