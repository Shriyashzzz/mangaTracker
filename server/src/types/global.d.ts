import "express-session";
import type { Manga } from "../../generated/prisma/client.js";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

declare global {
  namespace Express {
    interface Locals {
      // set by requireOwner
      manga: Manga;
    }
  }
}
