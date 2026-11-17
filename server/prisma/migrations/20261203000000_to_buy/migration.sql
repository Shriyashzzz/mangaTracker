-- A reader's To buy list: volumes they looked up and mean to buy
-- (toBuy/toBuy.ts). Deleted with the account.
CREATE TABLE "to_buy" (
    "user_id" INTEGER NOT NULL,
    "isbn13" CHAR(13) NOT NULL,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "to_buy_pkey" PRIMARY KEY ("user_id","isbn13")
);

ALTER TABLE "to_buy" ADD CONSTRAINT "to_buy_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
