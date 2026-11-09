-- a price whose shipping eBay calculates only at checkout: an estimate was
-- added, and the page says so
ALTER TABLE "price_samples" ADD COLUMN "shipping_estimated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ca_price_samples" ADD COLUMN "shipping_estimated" BOOLEAN NOT NULL DEFAULT false;
