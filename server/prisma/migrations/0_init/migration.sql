-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(40) NOT NULL,
    "password" TEXT NOT NULL,
    "prefs" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manga" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "name" TEXT NOT NULL,
    "genre" VARCHAR(100),
    "description" TEXT,
    "image" TEXT,
    "status" BOOLEAN NOT NULL DEFAULT false,
    "bookmark" INTEGER,
    "volumes_owned" SMALLINT,
    "rating" SMALLINT,

    CONSTRAINT "manga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "sid" VARCHAR NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- CreateTable
CREATE TABLE "books" (
    "isbn13" CHAR(13) NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT,
    "publisher" TEXT,
    "cover_url" TEXT,
    "year" SMALLINT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "books_pkey" PRIMARY KEY ("isbn13")
);

-- CreateTable
CREATE TABLE "price_samples" (
    "id" BIGSERIAL NOT NULL,
    "isbn13" CHAR(13) NOT NULL,
    "store" VARCHAR(60) NOT NULL,
    "format" VARCHAR(20) NOT NULL DEFAULT 'print',
    "condition" VARCHAR(20) NOT NULL DEFAULT 'new',
    "price_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "in_stock" BOOLEAN NOT NULL DEFAULT true,
    "url" TEXT,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_checks" (
    "isbn13" CHAR(13) NOT NULL,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "price_checks_pkey" PRIMARY KEY ("isbn13")
);

-- CreateTable
CREATE TABLE "series_info" (
    "slug" VARCHAR(80) NOT NULL,
    "info" JSONB,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "series_info_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "api_usage" (
    "provider" VARCHAR(40) NOT NULL,
    "month" DATE NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "api_usage_pkey" PRIMARY KEY ("provider","month")
);

-- CreateTable
CREATE TABLE "edition_covers" (
    "isbn13" CHAR(13) NOT NULL,
    "cover_id" INTEGER,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "edition_covers_pkey" PRIMARY KEY ("isbn13")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "IDX_session_expire" ON "session"("expire");

-- CreateIndex
CREATE INDEX "price_samples_isbn_time" ON "price_samples"("isbn13", "fetched_at" DESC);

-- AddForeignKey
ALTER TABLE "manga" ADD CONSTRAINT "manga_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "price_samples" ADD CONSTRAINT "price_samples_isbn13_fkey" FOREIGN KEY ("isbn13") REFERENCES "books"("isbn13") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "price_checks" ADD CONSTRAINT "price_checks_isbn13_fkey" FOREIGN KEY ("isbn13") REFERENCES "books"("isbn13") ON DELETE CASCADE ON UPDATE NO ACTION;


-- checks Prisma can't describe in the schema (the JS version had them)
ALTER TABLE "manga" ADD CONSTRAINT "manga_volumes_owned_check" CHECK ("volumes_owned" > 0);
ALTER TABLE "manga" ADD CONSTRAINT "manga_rating_check" CHECK ("rating" >= 0 AND "rating" <= 5);
ALTER TABLE "price_samples" ADD CONSTRAINT "price_samples_price_cents_check" CHECK ("price_cents" >= 0);
