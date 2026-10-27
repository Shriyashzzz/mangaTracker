// The Express app: middleware, sessions and routers. Kept apart from
// server.ts (which only listens) so tests can import it with supertest.
//
//   request ─> helmet ─> cors ─> session ─> body parsers ─> router ─> errorHandler
import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import config, { isProd } from "./config/config.js";
import { pool } from "./config/prisma.js";
import { authRouter, prefsRouter } from "./routes/authRouter.js";
import { mangaRouter } from "./routes/mangaRouter.js";
import { pricesRouter } from "./routes/pricesRouter.js";
import { seoRouter } from "./routes/seoRouter.js";
import { errorHandler } from "./middlewares/errorHandler.js";

export const app = express();

app.disable("x-powered-by");
// Railway's proxy terminates https; trust it so secure cookies and req.ip work
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
      // the site and API are different subdomains in production
      sameSite: isProd ? "none" : "lax",
      // only scoped to the real domain in prod; browsers drop it on localhost
      ...(isProd && { domain: config.COOKIE_DOMAIN }),
    },
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.use("/api/auth", authRouter);
app.use("/api/prefs", prefsRouter);
app.use("/api/manga", mangaRouter);
app.use("/api/prices", pricesRouter);
app.use("/", seoRouter);

app.use((_req, res) => {
  res.status(404).json({ error: [{ msg: "Not found" }] });
});
app.use(errorHandler);
