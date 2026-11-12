-- what they paid for a book and the day they bought it, both optional, for
-- "spent so far". Adds two columns to owned_books only.
ALTER TABLE "owned_books" ADD COLUMN "paid_cents" INTEGER;
ALTER TABLE "owned_books" ADD COLUMN "bought_on" DATE;
