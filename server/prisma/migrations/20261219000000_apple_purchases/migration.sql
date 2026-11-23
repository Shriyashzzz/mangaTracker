-- The Collector tier bought through the App Store (src/plan/applePurchases.ts):
-- the subscription's original transaction ID, which every renewal, refund
-- and expiry Apple tells us about carries
ALTER TABLE "users" ADD COLUMN "apple_subscription" VARCHAR(64);
CREATE UNIQUE INDEX "users_apple_subscription_key" ON "users"("apple_subscription");
