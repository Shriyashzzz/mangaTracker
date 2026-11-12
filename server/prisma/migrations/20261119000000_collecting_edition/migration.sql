-- which edition of a series they collect ("deluxe", "3in1"), so what to buy
-- next is counted in that edition's books. Null: single volumes, as before.
-- Adds a column only.
ALTER TABLE "manga" ADD COLUMN "edition" VARCHAR(20);
