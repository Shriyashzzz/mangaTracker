// The Express app: middleware, sessions and routers. Kept apart from
// server.ts (which only listens) so tests can import it with supertest.
//
//   request ─> helmet ─> cors ─> session ─> body parsers ─> router ─> errorHandler
import express from "express";
import { appleRouter } from "./plan/appleRouter.js";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import config, { isProd } from "./config/config.js";
import { pool } from "./config/prisma.js";
import { authRouter, prefsRouter } from "./routes/authRouter.js";
import {
  accountRouter,
  emailRouter,
  shareRouter,
} from "./routes/accountRouter.js";
import { pushRouter } from "./push/pushRoutes.js";
import { mangaRouter } from "./routes/mangaRouter.js";
import { pricesRouter } from "./routes/pricesRouter.js";
import { afterAnimeRouter } from "./routes/afterAnimeRouter.js";
import { editionsRouter } from "./routes/editionsRouter.js";
import { reviewsRouter } from "./routes/reviewsRouter.js";
import { toBuyRouter } from "./routes/toBuyRouter.js";
import { seoRouter } from "./routes/seoRouter.js";
import { collectorRouter } from "./collector/router.js";
import { historyRouter } from "./history/yearRouter.js";
import { followRoutes, friendsRouter } from "./friends/friends.js";
import { blocksRouter } from "./blocks/blocks.js";
import { errorHandler } from "./middlewares/errorHandler.js";

export const app = express();

app.disable("x-powered-by");
// Railway's proxy terminates https; trust it so secure cookies work. (The
// reader's own address, behind Cloudflare too, is util/clientIp.ts)
app.set("trust proxy", 1);

// the site loads cover images from this API on another subdomain
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.use(
  cors({
    // only the site may call us with cookies
    origin: config.CLIENT_URL ? [config.CLIENT_URL] : false,
    credentials: true,
  }),
);

const PgStore = connectPgSimple(session);
app.use(
  session({
    store: new PgStore({ pool, tableName: "session" }),
    secret: config.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // a week
      httpOnly: true,
      secure: isProd,
      // the site and API are subdomains of one site, which Lax still sends to,
      // while another site's form or script can't sign in, out or add as them
      sameSite: "lax",
      // only scoped to the real domain in prod; browsers drop it on localhost
      ...(isProd && { domain: config.COOKIE_DOMAIN }),
    },
  }),
);

// JSON only: the site never posts forms, and a form from another site is the
// one kind of cross-site request a browser sends without asking us first
app.use(express.json({ limit: "512kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.use("/api/auth", authRouter);
app.use("/api/prefs", prefsRouter);
app.use("/api/account", accountRouter);
app.use("/api/share", followRoutes);
app.use("/api/share", shareRouter);
app.use("/api/friends", friendsRouter);
app.use("/api/blocks", blocksRouter);
app.use("/api/email", emailRouter);
app.use("/api/push", pushRouter);
app.use("/api/manga", mangaRouter);
app.use("/api/prices", pricesRouter);
app.use("/api/after-anime", afterAnimeRouter);
app.use("/api/editions", editionsRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/to-buy", toBuyRouter);
app.use("/api/collector", collectorRouter);
app.use("/api/apple", appleRouter);
app.use("/api/history", historyRouter);
app.use("/", seoRouter);

app.use((_req, res) => {
  res.status(404).json({ error: [{ msg: "Not found" }] });
});
app.use(errorHandler);
