import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import config from "./config.js";
import { PrismaClient } from "../../generated/prisma/client.js";

// one pool for everything: Prisma's queries and the session store.
// Every connection runs in UTC: Prisma's pg adapter drops the offset from
// timestamptz values, so on a database set to another zone (Postgres.app
// uses the Mac's) every date would come back shifted by hours
export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  options: "-c timezone=UTC",
});
export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
